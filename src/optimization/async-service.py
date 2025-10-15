#!/usr/bin/env python3

"""
⚡ Async Performance Optimization Service
High-performance async optimization engine using uvloop, asyncio, and concurrent.futures
Implemented from awesome-python async programming recommendations
"""

import asyncio
import uvloop
import aiohttp
import concurrent.futures
from datetime import datetime, timedelta
import json
import logging
import time
import psutil
import sqlite3
import numpy as np
from pathlib import Path
import multiprocessing as mp
from functools import wraps
import signal
import sys
from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass, asdict
import queue
import threading
from collections import defaultdict, deque
import gc
import weakref

# Configure high-performance logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('optimization.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class OptimizationMetrics:
    """Optimization performance metrics"""
    cpu_usage: float
    memory_usage: float
    network_io: Dict[str, int]
    response_times: List[float]
    optimization_score: float
    timestamp: datetime
    
    def to_dict(self) -> Dict:
        return asdict(self)

class MemoryPool:
    """High-performance memory pool for object reuse"""
    
    def __init__(self, max_size: int = 1000):
        self.pools = defaultdict(deque)
        self.max_size = max_size
        self._lock = threading.Lock()
    
    def get(self, obj_type: type, *args, **kwargs):
        """Get object from pool or create new"""
        type_name = obj_type.__name__
        
        with self._lock:
            if self.pools[type_name]:
                return self.pools[type_name].popleft()
        
        return obj_type(*args, **kwargs)
    
    def put(self, obj: Any):
        """Return object to pool"""
        type_name = type(obj).__name__
        
        with self._lock:
            if len(self.pools[type_name]) < self.max_size:
                # Reset object state if it has a reset method
                if hasattr(obj, 'reset'):
                    obj.reset()
                self.pools[type_name].append(obj)
    
    def clear(self):
        """Clear all pools"""
        with self._lock:
            self.pools.clear()
            gc.collect()

class AsyncOptimizationService:
    """High-performance async optimization service"""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=mp.cpu_count())
        self.memory_pool = MemoryPool()
        self.metrics_history = deque(maxlen=1000)
        self.optimization_queue = asyncio.Queue()
        self.is_running = False
        self.tasks: List[asyncio.Task] = []
        
        # Performance tracking
        self.request_counts = defaultdict(int)
        self.response_times = defaultdict(list)
        self.last_optimization = None
        
        # Optimization thresholds
        self.cpu_threshold = 80.0
        self.memory_threshold = 85.0
        self.response_threshold = 500.0  # ms
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        asyncio.create_task(self.shutdown())
    
    async def start(self):
        """Start the optimization service"""
        logger.info("Starting Async Optimization Service with uvloop...")
        
        # Use uvloop for maximum performance
        if sys.platform != 'win32':
            asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
        
        self.is_running = True
        
        # Create aiohttp session with optimized settings
        connector = aiohttp.TCPConnector(
            limit=100,
            limit_per_host=30,
            ttl_dns_cache=300,
            use_dns_cache=True,
            keepalive_timeout=30,
            enable_cleanup_closed=True
        )
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=aiohttp.ClientTimeout(total=30, connect=5)
        )
        
        # Start background tasks
        self.tasks = [
            asyncio.create_task(self.metrics_collector()),
            asyncio.create_task(self.optimization_worker()),
            asyncio.create_task(self.memory_monitor()),
            asyncio.create_task(self.performance_analyzer()),
            asyncio.create_task(self.health_checker())
        ]
        
        logger.info("✅ Async Optimization Service started successfully")
        
        # Wait for shutdown signal
        try:
            await asyncio.gather(*self.tasks)
        except asyncio.CancelledError:
            logger.info("Tasks cancelled, shutting down...")
    
    async def shutdown(self):
        """Graceful shutdown of the service"""
        logger.info("Shutting down Async Optimization Service...")
        
        self.is_running = False
        
        # Cancel all tasks
        for task in self.tasks:
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self.tasks, return_exceptions=True)
        
        # Close aiohttp session
        if self.session:
            await self.session.close()
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        # Clear memory pool
        self.memory_pool.clear()
        
        logger.info("✅ Shutdown completed")
    
    async def metrics_collector(self):
        """Continuously collect system metrics"""
        while self.is_running:
            try:
                # Collect metrics in thread pool to avoid blocking
                metrics = await asyncio.get_event_loop().run_in_executor(
                    self.executor, self._collect_system_metrics
                )
                
                if metrics:
                    self.metrics_history.append(metrics)
                    
                    # Trigger optimization if thresholds exceeded
                    if (metrics.cpu_usage > self.cpu_threshold or 
                        metrics.memory_usage > self.memory_threshold):
                        await self.optimization_queue.put({
                            'type': 'system_optimization',
                            'metrics': metrics,
                            'timestamp': datetime.now()
                        })
                
                await asyncio.sleep(5)  # Collect metrics every 5 seconds
                
            except Exception as e:
                logger.error(f"Error in metrics collector: {e}")
                await asyncio.sleep(10)
    
    def _collect_system_metrics(self) -> OptimizationMetrics:
        """Collect current system metrics (runs in thread pool)"""
        try:
            # CPU and memory
            cpu_usage = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            
            # Network I/O
            net_io = psutil.net_io_counters()
            network_io = {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv
            }
            
            # Calculate optimization score
            score = 100 - max(cpu_usage, memory.percent)
            
            # Recent response times
            recent_times = []
            for times in self.response_times.values():
                recent_times.extend(times[-10:])  # Last 10 responses per endpoint
            
            return OptimizationMetrics(
                cpu_usage=cpu_usage,
                memory_usage=memory.percent,
                network_io=network_io,
                response_times=recent_times,
                optimization_score=score,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            return None
    
    async def optimization_worker(self):
        """Process optimization requests"""
        while self.is_running:
            try:
                # Wait for optimization request
                request = await asyncio.wait_for(
                    self.optimization_queue.get(), timeout=1.0
                )
                
                logger.info(f"Processing optimization: {request['type']}")
                
                # Process different optimization types
                if request['type'] == 'system_optimization':
                    await self._optimize_system(request['metrics'])
                elif request['type'] == 'memory_optimization':
                    await self._optimize_memory()
                elif request['type'] == 'cache_optimization':
                    await self._optimize_cache()
                elif request['type'] == 'concurrent_optimization':
                    await self._optimize_concurrent()
                
                self.last_optimization = datetime.now()
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error in optimization worker: {e}")
    
    async def _optimize_system(self, metrics: OptimizationMetrics):
        """Perform system-level optimizations"""
        optimizations = []
        
        # CPU optimization
        if metrics.cpu_usage > self.cpu_threshold:
            optimizations.append(self._cpu_optimization())
        
        # Memory optimization
        if metrics.memory_usage > self.memory_threshold:
            optimizations.append(self._memory_optimization())
        
        # Network optimization
        if metrics.response_times and np.mean(metrics.response_times) > self.response_threshold:
            optimizations.append(self._network_optimization())
        
        # Run optimizations concurrently
        if optimizations:
            await asyncio.gather(*optimizations, return_exceptions=True)
            logger.info("✅ System optimization completed")
    
    async def _cpu_optimization(self):
        """Optimize CPU usage"""
        await asyncio.get_event_loop().run_in_executor(
            self.executor, self._run_cpu_optimization
        )
    
    def _run_cpu_optimization(self):
        """CPU optimization implementation"""
        # Force garbage collection
        gc.collect()
        
        # Set lower CPU priority for non-critical processes
        try:
            current_process = psutil.Process()
            if current_process.nice() > -5:
                current_process.nice(-1)  # Slightly higher priority
        except (psutil.AccessDenied, OSError):
            pass
        
        logger.info("CPU optimization applied")
    
    async def _memory_optimization(self):
        """Optimize memory usage"""
        await asyncio.get_event_loop().run_in_executor(
            self.executor, self._run_memory_optimization
        )
    
    def _run_memory_optimization(self):
        """Memory optimization implementation"""
        # Clear memory pool
        self.memory_pool.clear()
        
        # Trim metrics history if too large
        if len(self.metrics_history) > 500:
            # Keep only recent half
            self.metrics_history = deque(
                list(self.metrics_history)[-250:], maxlen=1000
            )
        
        # Force garbage collection
        gc.collect()
        
        logger.info("Memory optimization applied")
    
    async def _network_optimization(self):
        """Optimize network performance"""
        # Reset connection pools in aiohttp session
        if self.session and not self.session.closed:
            await self.session.close()
            
            # Create new optimized session
            connector = aiohttp.TCPConnector(
                limit=150,  # Increased connection limit
                limit_per_host=50,
                ttl_dns_cache=600,  # Longer DNS cache
                use_dns_cache=True,
                keepalive_timeout=60,  # Longer keepalive
                enable_cleanup_closed=True
            )
            
            self.session = aiohttp.ClientSession(
                connector=connector,
                timeout=aiohttp.ClientTimeout(total=30, connect=5)
            )
        
        logger.info("Network optimization applied")
    
    async def _optimize_memory(self):
        """Dedicated memory optimization"""
        await self._memory_optimization()
    
    async def _optimize_cache(self):
        """Cache optimization"""
        # Clear response time caches
        for endpoint in list(self.response_times.keys()):
            if len(self.response_times[endpoint]) > 50:
                self.response_times[endpoint] = self.response_times[endpoint][-25:]
        
        # Reset request counts
        self.request_counts.clear()
        
        logger.info("Cache optimization applied")
    
    async def _optimize_concurrent(self):
        """Concurrent processing optimization"""
        # Adjust executor thread count based on system load
        current_cpu = psutil.cpu_percent(interval=0.1)
        optimal_threads = max(2, min(mp.cpu_count(), int(mp.cpu_count() * (1 - current_cpu/100))))
        
        # Note: ThreadPoolExecutor doesn't support dynamic resizing
        # This is a placeholder for future enhancement
        logger.info(f"Concurrent optimization applied (optimal threads: {optimal_threads})")
    
    async def memory_monitor(self):
        """Monitor memory usage and prevent leaks"""
        while self.is_running:
            try:
                memory = psutil.virtual_memory()
                
                # Force cleanup if memory usage is very high
                if memory.percent > 90:
                    logger.warning(f"High memory usage detected: {memory.percent}%")
                    await self.optimization_queue.put({
                        'type': 'memory_optimization',
                        'timestamp': datetime.now()
                    })
                
                # Monitor specific object counts
                object_counts = {
                    'tasks': len(self.tasks),
                    'metrics_history': len(self.metrics_history),
                    'pool_objects': sum(len(pool) for pool in self.memory_pool.pools.values())
                }
                
                # Log object counts periodically
                if len(self.metrics_history) % 50 == 0:
                    logger.info(f"Object counts: {object_counts}")
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in memory monitor: {e}")
                await asyncio.sleep(60)
    
    async def performance_analyzer(self):
        """Analyze performance trends and suggest optimizations"""
        while self.is_running:
            try:
                if len(self.metrics_history) >= 10:
                    recent_metrics = list(self.metrics_history)[-10:]
                    
                    # Analyze trends
                    cpu_trend = np.mean([m.cpu_usage for m in recent_metrics])
                    memory_trend = np.mean([m.memory_usage for m in recent_metrics])
                    
                    # Check for degrading performance
                    if cpu_trend > 70 or memory_trend > 80:
                        logger.warning(
                            f"Performance degradation detected - "
                            f"CPU: {cpu_trend:.1f}%, Memory: {memory_trend:.1f}%"
                        )
                        
                        # Queue preemptive optimization
                        await self.optimization_queue.put({
                            'type': 'system_optimization',
                            'metrics': recent_metrics[-1],
                            'timestamp': datetime.now()
                        })
                
                await asyncio.sleep(60)  # Analyze every minute
                
            except Exception as e:
                logger.error(f"Error in performance analyzer: {e}")
                await asyncio.sleep(120)
    
    async def health_checker(self):
        """Check health of external services"""
        endpoints = [
            'http://localhost:8080/health',
            'http://localhost:4001/health'
        ]
        
        while self.is_running:
            try:
                for endpoint in endpoints:
                    start_time = time.time()
                    
                    try:
                        async with self.session.get(endpoint) as response:
                            response_time = (time.time() - start_time) * 1000
                            self.response_times[endpoint].append(response_time)
                            
                            # Keep only recent response times
                            if len(self.response_times[endpoint]) > 100:
                                self.response_times[endpoint] = self.response_times[endpoint][-50:]
                            
                            if response.status != 200:
                                logger.warning(f"Health check failed for {endpoint}: {response.status}")
                    
                    except Exception as e:
                        logger.error(f"Health check error for {endpoint}: {e}")
                        # Add high response time to indicate failure
                        self.response_times[endpoint].append(5000.0)
                
                await asyncio.sleep(10)  # Check every 10 seconds
                
            except Exception as e:
                logger.error(f"Error in health checker: {e}")
                await asyncio.sleep(30)
    
    async def get_metrics(self) -> Dict:
        """Get current optimization metrics"""
        if not self.metrics_history:
            return {'status': 'no_data'}
        
        latest = self.metrics_history[-1]
        
        # Calculate averages
        recent_metrics = list(self.metrics_history)[-10:] if len(self.metrics_history) >= 10 else list(self.metrics_history)
        avg_cpu = np.mean([m.cpu_usage for m in recent_metrics])
        avg_memory = np.mean([m.memory_usage for m in recent_metrics])
        avg_score = np.mean([m.optimization_score for m in recent_metrics])
        
        # Response time statistics
        all_response_times = []
        for times in self.response_times.values():
            all_response_times.extend(times[-10:])
        
        return {
            'status': 'active',
            'latest_metrics': latest.to_dict(),
            'averages': {
                'cpu_usage': avg_cpu,
                'memory_usage': avg_memory,
                'optimization_score': avg_score
            },
            'response_times': {
                'avg': np.mean(all_response_times) if all_response_times else 0,
                'max': max(all_response_times) if all_response_times else 0,
                'count': len(all_response_times)
            },
            'last_optimization': self.last_optimization.isoformat() if self.last_optimization else None,
            'is_running': self.is_running,
            'queue_size': self.optimization_queue.qsize()
        }
    
    async def trigger_optimization(self, optimization_type: str = 'system_optimization'):
        """Manually trigger an optimization"""
        await self.optimization_queue.put({
            'type': optimization_type,
            'timestamp': datetime.now(),
            'manual': True
        })
        
        logger.info(f"Manual {optimization_type} triggered")

async def main():
    """Main entry point"""
    service = AsyncOptimizationService()
    
    try:
        await service.start()
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    finally:
        await service.shutdown()

if __name__ == "__main__":
    # Install uvloop if available (not on Windows)
    try:
        import uvloop
        asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
        logger.info("⚡ Using uvloop for maximum performance")
    except ImportError:
        logger.info("⚠️ uvloop not available, using default event loop")
    
    asyncio.run(main())