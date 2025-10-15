#!/usr/bin/env python3

"""
🚀 FastAPI High-Performance LLM API Server
Modern, fast web framework for building APIs with Python 3.6+ based on standard type hints
Implemented from awesome-python RESTful API recommendations
"""

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Union, Any
import asyncio
import aiohttp
import time
import logging
import json
from datetime import datetime, timedelta
import psutil
import sqlite3
from contextlib import asynccontextmanager
import signal
import sys
from pathlib import Path
from collections import defaultdict, deque
import asyncio
from concurrent.futures import ThreadPoolExecutor
import multiprocessing as mp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state for the application
app_state = {
    "metrics": defaultdict(list),
    "connections": 0,
    "request_count": 0,
    "start_time": datetime.now(),
    "optimization_service": None
}

# Security
security = HTTPBearer(auto_error=False)

# Pydantic models
class OptimizationRequest(BaseModel):
    """Request model for optimization operations"""
    action: str = Field(..., description="Optimization action to perform")
    parameters: Optional[Dict[str, Any]] = Field(default={}, description="Optional parameters")
    priority: Optional[int] = Field(default=1, ge=1, le=5, description="Priority level (1-5)")
    
    @validator('action')
    def validate_action(cls, v):
        allowed_actions = ['start', 'stop', 'status', 'concurrent', 'memory', 'cache', 'breakthrough']
        if v not in allowed_actions:
            raise ValueError(f'Action must be one of: {allowed_actions}')
        return v

class ChatRequest(BaseModel):
    """Request model for chat operations"""
    message: str = Field(..., min_length=1, max_length=10000, description="User message")
    model: Optional[str] = Field(default="claude-3", description="LLM model to use")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0, description="Response creativity")
    max_tokens: Optional[int] = Field(default=1000, ge=1, le=4000, description="Maximum response tokens")
    stream: Optional[bool] = Field(default=False, description="Enable streaming response")

class HealthResponse(BaseModel):
    """Health check response model"""
    status: str
    timestamp: datetime
    uptime_seconds: float
    version: str = "2.1.0-fastapi"
    connections: int
    request_count: int
    system_metrics: Dict[str, float]

class MetricsResponse(BaseModel):
    """Metrics response model"""
    timestamp: datetime
    system: Dict[str, float]
    application: Dict[str, Any]
    performance: Dict[str, float]
    optimization: Dict[str, Any]

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    logger.info("🚀 Starting FastAPI LLM Server...")
    
    # Startup
    app_state["start_time"] = datetime.now()
    
    # Initialize optimization service connection
    try:
        app_state["session"] = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        logger.info("✅ HTTP session initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize HTTP session: {e}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down FastAPI LLM Server...")
    if "session" in app_state:
        await app_state["session"].close()
    logger.info("✅ Shutdown completed")

# Create FastAPI application
app = FastAPI(
    title="LLM Enterprise API",
    description="High-performance FastAPI server for LLM operations with advanced optimization",
    version="2.1.0-fastapi",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request tracking middleware
@app.middleware("http")
async def track_requests(request: Request, call_next):
    """Track request metrics"""
    start_time = time.time()
    app_state["connections"] += 1
    app_state["request_count"] += 1
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    app_state["metrics"]["response_times"].append(process_time * 1000)
    
    # Keep only recent metrics
    if len(app_state["metrics"]["response_times"]) > 1000:
        app_state["metrics"]["response_times"] = app_state["metrics"]["response_times"][-500:]
    
    app_state["connections"] -= 1
    
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Dependency injection
async def get_system_metrics() -> Dict[str, float]:
    """Get current system metrics"""
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_available_gb": memory.available / (1024**3),
            "disk_percent": disk.percent,
            "disk_free_gb": disk.free / (1024**3)
        }
    except Exception as e:
        logger.error(f"Error getting system metrics: {e}")
        return {}

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify API token (placeholder implementation)"""
    if credentials:
        # Implement actual token verification here
        if credentials.credentials == "dev-token-123":
            return credentials.credentials
    return None

# API Routes

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "message": "🚀 LLM Enterprise API",
        "version": "2.1.0-fastapi",
        "docs": "/docs",
        "status": "operational",
        "timestamp": datetime.now()
    }

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check(system_metrics: Dict = Depends(get_system_metrics)):
    """Comprehensive health check"""
    uptime = (datetime.now() - app_state["start_time"]).total_seconds()
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        uptime_seconds=uptime,
        connections=app_state["connections"],
        request_count=app_state["request_count"],
        system_metrics=system_metrics
    )

@app.get("/metrics", response_model=MetricsResponse, tags=["System"])
async def get_metrics(system_metrics: Dict = Depends(get_system_metrics)):
    """Get comprehensive system and application metrics"""
    
    # Calculate performance metrics
    response_times = app_state["metrics"]["response_times"]
    performance_metrics = {
        "avg_response_time": sum(response_times) / len(response_times) if response_times else 0,
        "max_response_time": max(response_times) if response_times else 0,
        "min_response_time": min(response_times) if response_times else 0,
        "total_requests": app_state["request_count"]
    }
    
    # Application metrics
    uptime = (datetime.now() - app_state["start_time"]).total_seconds()
    app_metrics = {
        "uptime_seconds": uptime,
        "active_connections": app_state["connections"],
        "total_requests": app_state["request_count"],
        "requests_per_second": app_state["request_count"] / max(uptime, 1)
    }
    
    return MetricsResponse(
        timestamp=datetime.now(),
        system=system_metrics,
        application=app_metrics,
        performance=performance_metrics,
        optimization={"status": "active", "service": "fastapi"}
    )

@app.get("/metrics/concurrent", tags=["Optimization"])
async def get_concurrent_metrics():
    """Get concurrent processing metrics"""
    try:
        if "session" in app_state:
            async with app_state["session"].get("http://localhost:8080/metrics/concurrent") as response:
                if response.status == 200:
                    data = await response.json()
                    return data
        
        # Fallback metrics
        return {
            "status": "fastapi_mode",
            "concurrent_requests": app_state["connections"],
            "total_processed": app_state["request_count"],
            "avg_response_time": sum(app_state["metrics"]["response_times"][-10:]) / 10 if app_state["metrics"]["response_times"] else 0
        }
    except Exception as e:
        logger.error(f"Error getting concurrent metrics: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/api/chat", tags=["LLM"])
async def chat_completion(request: ChatRequest, background_tasks: BackgroundTasks):
    """Handle chat completion requests"""
    start_time = time.time()
    
    try:
        # Simulate LLM processing
        await asyncio.sleep(0.1)  # Simulate processing time
        
        # Log request for analytics
        background_tasks.add_task(
            log_chat_request, 
            request.message, 
            request.model, 
            time.time() - start_time
        )
        
        if request.stream:
            return StreamingResponse(
                generate_streaming_response(request),
                media_type="text/plain"
            )
        
        response = {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request.model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": f"FastAPI Response to: {request.message[:100]}..."
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": len(request.message.split()),
                "completion_tokens": 50,
                "total_tokens": len(request.message.split()) + 50
            }
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_streaming_response(request: ChatRequest):
    """Generate streaming chat response"""
    response_text = f"Streaming response to: {request.message}"
    
    for i, char in enumerate(response_text):
        yield f"data: {{\"content\": \"{char}\", \"index\": {i}}}\n\n"
        await asyncio.sleep(0.05)  # Simulate streaming delay
    
    yield "data: [DONE]\n\n"

@app.get("/api/models", tags=["LLM"])
async def list_models():
    """List available LLM models"""
    return {
        "object": "list",
        "data": [
            {
                "id": "claude-3",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "anthropic",
                "permission": [],
                "root": "claude-3",
                "parent": None
            },
            {
                "id": "gpt-4",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "openai",
                "permission": [],
                "root": "gpt-4",
                "parent": None
            }
        ]
    }

@app.post("/optimize/{optimization_type}", tags=["Optimization"])
async def trigger_optimization(
    optimization_type: str,
    request: OptimizationRequest,
    background_tasks: BackgroundTasks
):
    """Trigger various types of optimization"""
    
    # Validate optimization type
    valid_types = ['concurrent', 'memory', 'cache', 'breakthrough', 'system']
    if optimization_type not in valid_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid optimization type. Must be one of: {valid_types}"
        )
    
    # Queue optimization in background
    background_tasks.add_task(
        run_optimization, 
        optimization_type, 
        request.parameters, 
        request.priority
    )
    
    return {
        "status": "accepted",
        "optimization_type": optimization_type,
        "action": request.action,
        "priority": request.priority,
        "timestamp": datetime.now(),
        "message": f"Optimization '{optimization_type}' queued successfully"
    }

@app.get("/optimize/status", tags=["Optimization"])
async def optimization_status():
    """Get optimization service status"""
    try:
        if "session" in app_state:
            async with app_state["session"].get("http://localhost:8080/optimize/status") as response:
                if response.status == 200:
                    return await response.json()
        
        # Fallback status
        return {
            "status": "active",
            "service": "fastapi",
            "optimizations_completed": 0,
            "last_optimization": None,
            "queue_size": 0
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/history", tags=["Data"])
async def get_history(limit: int = 100, offset: int = 0):
    """Get browsing history data"""
    try:
        # Connect to SQLite database
        conn = sqlite3.connect("browser_history.db")
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM history ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            (limit, offset)
        )
        
        rows = cursor.fetchall()
        conn.close()
        
        return {
            "status": "success",
            "count": len(rows),
            "limit": limit,
            "offset": offset,
            "data": [{
                "id": row[0],
                "url": row[1],
                "title": row[2],
                "timestamp": row[3]
            } for row in rows]
        }
        
    except Exception as e:
        logger.error(f"History retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Background tasks
async def log_chat_request(message: str, model: str, processing_time: float):
    """Log chat request for analytics"""
    logger.info(f"Chat request processed - Model: {model}, Time: {processing_time:.3f}s")

async def run_optimization(optimization_type: str, parameters: Dict, priority: int):
    """Run optimization in background"""
    logger.info(f"Running {optimization_type} optimization with priority {priority}")
    
    # Simulate optimization work
    await asyncio.sleep(1.0)
    
    # Here you would integrate with actual optimization services
    try:
        if "session" in app_state:
            async with app_state["session"].post(
                f"http://localhost:8080/optimize/{optimization_type}",
                json={"action": "start", "parameters": parameters}
            ) as response:
                if response.status == 200:
                    logger.info(f"✅ {optimization_type} optimization completed")
                else:
                    logger.warning(f"⚠️ {optimization_type} optimization failed: {response.status}")
    except Exception as e:
        logger.error(f"❌ Optimization error: {e}")

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": "The requested resource was not found",
            "path": str(request.url),
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An internal server error occurred",
            "timestamp": datetime.now().isoformat()
        }
    )

# Main execution
if __name__ == "__main__":
    import uvloop
    
    # Use uvloop for better performance
    try:
        asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
        logger.info("⚡ Using uvloop for maximum performance")
    except ImportError:
        logger.info("⚠️ uvloop not available, using default event loop")
    
    # Run the server
    uvicorn.run(
        "fastapi-server:app",
        host="0.0.0.0",
        port=8081,
        reload=False,
        workers=1,
        loop="uvloop",
        log_level="info",
        access_log=True
    )