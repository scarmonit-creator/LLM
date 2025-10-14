#!/usr/bin/env python3
"""
Cloud-Based GClient Evaluator Service
High-performance, always-on gclient condition evaluation service
"""

import asyncio
import aiohttp
from aiohttp import web
import json
import time
import logging
import os
from typing import Dict, Any, List
import redis
import uvloop
from datetime import datetime
import hashlib
import ast
from functools import lru_cache
import threading
from dataclasses import dataclass
from pathlib import Path

@dataclass
class ServiceConfig:
    """Service configuration"""
    port: int = int(os.getenv('PORT', 8080))
    redis_url: str = os.getenv('REDIS_URL', 'redis://localhost:6379')
    max_workers: int = int(os.getenv('MAX_WORKERS', 4))
    cache_size: int = int(os.getenv('CACHE_SIZE', 10000))
    enable_metrics: bool = os.getenv('ENABLE_METRICS', 'true').lower() == 'true'
    log_level: str = os.getenv('LOG_LEVEL', 'INFO')

class CloudGClientEvaluator:
    """Cloud-based high-performance gclient evaluator service."""
    
    def __init__(self, config: ServiceConfig):
        self.config = config
        self.redis_client = None
        self.local_cache = {}
        self.stats = {
            'requests': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'errors': 0,
            'avg_response_time': 0.0,
            'uptime_start': time.time()
        }
        self._lock = threading.RLock()
        
        # Setup logging
        logging.basicConfig(level=getattr(logging, config.log_level))
        self.logger = logging.getLogger(__name__)
        
        # Initialize allowed AST nodes for security
        self._allowed_nodes = frozenset({
            ast.Expression, ast.BinOp, ast.BoolOp, ast.Compare, ast.Name, 
            ast.Str, ast.Num, ast.List, ast.Dict, ast.Tuple, ast.Load,
            ast.And, ast.Or, ast.Not, ast.Eq, ast.NotEq, ast.Lt, ast.Gt,
            ast.LtE, ast.GtE, ast.In, ast.NotIn, ast.Is, ast.IsNot,
            ast.Constant if hasattr(ast, 'Constant') else ast.Str
        })

    async def initialize(self):
        """Initialize Redis connection and service components."""
        try:
            self.redis_client = redis.from_url(self.config.redis_url, decode_responses=True)
            await asyncio.get_event_loop().run_in_executor(None, self.redis_client.ping)
            self.logger.info("Redis connection established")
        except Exception as e:
            self.logger.warning(f"Redis connection failed: {e}. Using local cache only.")
            self.redis_client = None

    def _generate_cache_key(self, condition: str, variables: Dict[str, Any]) -> str:
        """Generate a stable cache key."""
        var_str = json.dumps(variables, sort_keys=True, default=str)
        combined = f"{condition}|{var_str}"
        return hashlib.md5(combined.encode()).hexdigest()

    @lru_cache(maxsize=1000)
    def _validate_and_compile(self, condition: str):
        """Validate AST and compile condition with caching."""
        try:
            node = ast.parse(condition, mode='eval')
            self._validate_ast_security(node)
            return compile(node, '<condition>', 'eval')
        except Exception as e:
            self.logger.warning(f"Compilation failed for '{condition}': {e}")
            return None

    def _validate_ast_security(self, node):
        """Security validation of AST nodes."""
        stack = [node]
        while stack:
            current = stack.pop()
            if type(current) not in self._allowed_nodes:
                raise ValueError(f"Unsafe AST node: {type(current).__name__}")
            stack.extend(ast.iter_child_nodes(current))

    async def _get_from_cache(self, cache_key: str) -> Any:
        """Get value from distributed cache (Redis) or local cache."""
        # Try Redis first
        if self.redis_client:
            try:
                value = await asyncio.get_event_loop().run_in_executor(
                    None, self.redis_client.get, cache_key
                )
                if value:
                    return json.loads(value)
            except Exception as e:
                self.logger.warning(f"Redis get failed: {e}")
        
        # Fallback to local cache
        return self.local_cache.get(cache_key)

    async def _set_cache(self, cache_key: str, value: Any, ttl: int = 3600):
        """Set value in distributed cache with TTL."""
        # Set in Redis
        if self.redis_client:
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, 
                    lambda: self.redis_client.setex(cache_key, ttl, json.dumps(value))
                )
            except Exception as e:
                self.logger.warning(f"Redis set failed: {e}")
        
        # Set in local cache with size limit
        if len(self.local_cache) >= self.config.cache_size:
            # Remove oldest 20% of entries
            items_to_remove = self.config.cache_size // 5
            for _ in range(items_to_remove):
                self.local_cache.pop(next(iter(self.local_cache)), None)
        
        self.local_cache[cache_key] = value

    async def evaluate_condition(self, condition: str, variables: Dict[str, Any] = None) -> Dict[str, Any]:
        """High-performance condition evaluation with distributed caching."""
        start_time = time.time()
        
        with self._lock:
            self.stats['requests'] += 1
        
        try:
            # Input validation and normalization
            if not condition or not condition.strip():
                return {'result': True, 'cached': False, 'evaluation_time': 0.001}
            
            condition = condition.strip()
            variables = variables or {}
            
            # Fast path for boolean literals
            literal_map = {'True': True, 'true': True, '1': True, 
                          'False': False, 'false': False, '0': False}
            if condition in literal_map:
                return {
                    'result': literal_map[condition], 
                    'cached': True, 
                    'evaluation_time': 0.0001
                }
            
            # Generate cache key
            cache_key = self._generate_cache_key(condition, variables)
            
            # Check cache
            cached_result = await self._get_from_cache(cache_key)
            if cached_result is not None:
                with self._lock:
                    self.stats['cache_hits'] += 1
                return {
                    'result': cached_result, 
                    'cached': True, 
                    'evaluation_time': time.time() - start_time
                }
            
            # Cache miss - evaluate
            with self._lock:
                self.stats['cache_misses'] += 1
            
            # Compile condition
            code_obj = self._validate_and_compile(condition)
            if not code_obj:
                raise ValueError("Invalid or unsafe condition")
            
            # Create safe evaluation environment
            safe_globals = {
                '__builtins__': {
                    'len': len, 'str': str, 'int': int, 'bool': bool,
                    'True': True, 'False': False, 'None': None
                }
            }
            safe_globals.update(variables)
            
            # Evaluate
            result = bool(eval(code_obj, safe_globals, {}))
            
            # Cache result
            await self._set_cache(cache_key, result)
            
            evaluation_time = time.time() - start_time
            
            # Update stats
            with self._lock:
                self.stats['avg_response_time'] = (
                    (self.stats['avg_response_time'] * (self.stats['requests'] - 1) + evaluation_time) / 
                    self.stats['requests']
                )
            
            return {
                'result': result, 
                'cached': False, 
                'evaluation_time': evaluation_time
            }
            
        except Exception as e:
            with self._lock:
                self.stats['errors'] += 1
            
            self.logger.error(f"Evaluation failed: {condition} - {e}")
            return {
                'result': False, 
                'error': str(e), 
                'cached': False, 
                'evaluation_time': time.time() - start_time
            }

class GClientEvaluatorServer:
    """HTTP server for the gclient evaluator service."""
    
    def __init__(self, evaluator: CloudGClientEvaluator):
        self.evaluator = evaluator
        self.app = web.Application()
        self._setup_routes()
        self._setup_middleware()

    def _setup_middleware(self):
        """Setup middleware for CORS, logging, etc."""
        
        @web.middleware
        async def cors_handler(request, handler):
            response = await handler(request)
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
            return response
        
        @web.middleware
        async def error_handler(request, handler):
            try:
                return await handler(request)
            except Exception as e:
                self.evaluator.logger.error(f"Request error: {e}")
                return web.json_response({
                    'error': str(e),
                    'success': False
                }, status=500)
        
        self.app.middlewares.append(cors_handler)
        self.app.middlewares.append(error_handler)

    def _setup_routes(self):
        """Setup HTTP routes."""
        self.app.router.add_post('/evaluate', self.handle_evaluate)
        self.app.router.add_post('/batch-evaluate', self.handle_batch_evaluate)
        self.app.router.add_get('/health', self.handle_health)
        self.app.router.add_get('/stats', self.handle_stats)
        self.app.router.add_get('/metrics', self.handle_metrics)
        self.app.router.add_options('/{path:.*}', self.handle_options)

    async def handle_evaluate(self, request):
        """Handle single condition evaluation."""
        try:
            data = await request.json()
            condition = data.get('condition')
            variables = data.get('variables', {})
            
            if not condition:
                return web.json_response({
                    'error': 'condition is required',
                    'success': False
                }, status=400)
            
            result = await self.evaluator.evaluate_condition(condition, variables)
            
            return web.json_response({
                'success': True,
                **result
            })
            
        except json.JSONDecodeError:
            return web.json_response({
                'error': 'Invalid JSON in request body',
                'success': False
            }, status=400)

    async def handle_batch_evaluate(self, request):
        """Handle batch condition evaluation."""
        try:
            data = await request.json()
            evaluations = data.get('evaluations', [])
            
            if not evaluations or not isinstance(evaluations, list):
                return web.json_response({
                    'error': 'evaluations array is required',
                    'success': False
                }, status=400)
            
            results = []
            for i, eval_data in enumerate(evaluations):
                condition = eval_data.get('condition')
                variables = eval_data.get('variables', {})
                
                if not condition:
                    results.append({
                        'index': i,
                        'error': 'condition is required',
                        'success': False
                    })
                    continue
                
                result = await self.evaluator.evaluate_condition(condition, variables)
                results.append({
                    'index': i,
                    'success': True,
                    **result
                })
            
            return web.json_response({
                'success': True,
                'results': results
            })
            
        except json.JSONDecodeError:
            return web.json_response({
                'error': 'Invalid JSON in request body',
                'success': False
            }, status=400)

    async def handle_health(self, request):
        """Health check endpoint."""
        return web.json_response({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'uptime': time.time() - self.evaluator.stats['uptime_start'],
            'version': '1.0.0'
        })

    async def handle_stats(self, request):
        """Statistics endpoint."""
        stats = self.evaluator.stats.copy()
        stats['uptime'] = time.time() - stats['uptime_start']
        stats['cache_hit_rate'] = (
            (stats['cache_hits'] / (stats['cache_hits'] + stats['cache_misses']) * 100)
            if (stats['cache_hits'] + stats['cache_misses']) > 0 else 0
        )
        return web.json_response(stats)

    async def handle_metrics(self, request):
        """Prometheus-style metrics endpoint."""
        stats = self.evaluator.stats.copy()
        cache_hit_rate = (
            (stats['cache_hits'] / (stats['cache_hits'] + stats['cache_misses']) * 100)
            if (stats['cache_hits'] + stats['cache_misses']) > 0 else 0
        )
        
        metrics = f"""# HELP gclient_requests_total Total number of evaluation requests
# TYPE gclient_requests_total counter
gclient_requests_total {stats['requests']}

# HELP gclient_cache_hits_total Total number of cache hits
# TYPE gclient_cache_hits_total counter
gclient_cache_hits_total {stats['cache_hits']}

# HELP gclient_cache_misses_total Total number of cache misses
# TYPE gclient_cache_misses_total counter
gclient_cache_misses_total {stats['cache_misses']}

# HELP gclient_errors_total Total number of evaluation errors
# TYPE gclient_errors_total counter
gclient_errors_total {stats['errors']}

# HELP gclient_cache_hit_rate Cache hit rate percentage
# TYPE gclient_cache_hit_rate gauge
gclient_cache_hit_rate {cache_hit_rate}

# HELP gclient_avg_response_time Average response time in seconds
# TYPE gclient_avg_response_time gauge
gclient_avg_response_time {stats['avg_response_time']}

# HELP gclient_uptime_seconds Service uptime in seconds
# TYPE gclient_uptime_seconds gauge
gclient_uptime_seconds {time.time() - stats['uptime_start']}
"""
        return web.Response(text=metrics, content_type='text/plain')

    async def handle_options(self, request):
        """Handle CORS preflight requests."""
        return web.Response(status=200)

async def create_app():
    """Create and configure the application."""
    config = ServiceConfig()
    evaluator = CloudGClientEvaluator(config)
    await evaluator.initialize()
    
    server = GClientEvaluatorServer(evaluator)
    return server.app

def main():
    """Main entry point."""
    # Use uvloop for better performance
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    
    config = ServiceConfig()
    
    print(f"🚀 Starting GClient Evaluator Service")
    print(f"📍 Port: {config.port}")
    print(f"🔗 Redis: {config.redis_url}")
    print(f"👥 Workers: {config.max_workers}")
    print(f"💾 Cache Size: {config.cache_size}")
    
    web.run_app(
        create_app(),
        host='0.0.0.0',
        port=config.port,
        access_log=logging.getLogger('aiohttp.access')
    )

if __name__ == '__main__':
    main()
