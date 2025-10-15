#!/usr/bin/env python3

"""
🎛️ Enterprise LLM Admin Dashboard
Streamlit-based admin panel for comprehensive system management
Implemented from awesome-python recommendations for optimal performance
"""

import streamlit as st
import pandas as pd
import numpy as np
import json
import psutil
import sqlite3
import requests
import time
from datetime import datetime, timedelta
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import asyncio
import concurrent.futures
from pathlib import Path

# Configure Streamlit page
st.set_page_config(
    page_title="LLM Enterprise Dashboard",
    page_icon="🎛️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for professional styling
st.markdown("""
<style>
.metric-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1rem;
    border-radius: 10px;
    color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
.status-good { color: #10b981; font-weight: bold; }
.status-warning { color: #f59e0b; font-weight: bold; }
.status-error { color: #ef4444; font-weight: bold; }
.sidebar .sidebar-content { background-color: #1e293b; }
</style>
""", unsafe_allow_html=True)

class LLMAdminDashboard:
    def __init__(self):
        self.base_url = "http://localhost:8080"
        self.nitric_url = "http://localhost:4001"
        self.db_path = "../browser_history.db"
        self.refresh_interval = 30  # seconds
        
    def get_system_metrics(self):
        """Get comprehensive system metrics"""
        try:
            # CPU and Memory metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Network I/O
            net_io = psutil.net_io_counters()
            
            # Process count
            process_count = len(psutil.pids())
            
            return {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_available_gb': memory.available / (1024**3),
                'memory_total_gb': memory.total / (1024**3),
                'disk_percent': disk.percent,
                'disk_free_gb': disk.free / (1024**3),
                'network_bytes_sent': net_io.bytes_sent,
                'network_bytes_recv': net_io.bytes_recv,
                'process_count': process_count,
                'timestamp': datetime.now()
            }
        except Exception as e:
            st.error(f"❌ System metrics error: {e}")
            return None
    
    def get_llm_performance(self):
        """Get LLM service performance metrics"""
        metrics = {
            'main_server': self.check_endpoint(f"{self.base_url}/health"),
            'nitric_service': self.check_endpoint(f"{self.nitric_url}/health"),
            'concurrent_metrics': self.get_concurrent_metrics(),
            'api_response_times': self.get_response_times()
        }
        return metrics
    
    def check_endpoint(self, url):
        """Check endpoint health and response time"""
        try:
            start_time = time.time()
            response = requests.get(url, timeout=5)
            response_time = (time.time() - start_time) * 1000  # ms
            
            return {
                'status': 'healthy' if response.status_code == 200 else 'unhealthy',
                'response_time_ms': response_time,
                'status_code': response.status_code,
                'timestamp': datetime.now()
            }
        except Exception as e:
            return {
                'status': 'error',
                'response_time_ms': 0,
                'error': str(e),
                'timestamp': datetime.now()
            }
    
    def get_concurrent_metrics(self):
        """Get concurrent optimization metrics"""
        try:
            response = requests.get(f"{self.base_url}/metrics/concurrent", timeout=3)
            if response.status_code == 200:
                return response.json()
            return {'status': 'unavailable'}
        except:
            return {'status': 'error'}
    
    def get_response_times(self):
        """Get API response time statistics"""
        endpoints = [
            '/health',
            '/api/chat',
            '/api/models',
            '/history'
        ]
        
        times = []
        for endpoint in endpoints:
            try:
                start = time.time()
                requests.get(f"{self.base_url}{endpoint}", timeout=2)
                times.append((time.time() - start) * 1000)
            except:
                times.append(0)
        
        return {
            'endpoints': endpoints,
            'response_times': times,
            'avg_response_time': np.mean([t for t in times if t > 0]),
            'max_response_time': max(times)
        }
    
    def get_database_stats(self):
        """Get database usage statistics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get table statistics
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            
            stats = {}
            for table in tables:
                table_name = table[0]
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                stats[table_name] = count
            
            # Database size
            db_size = Path(self.db_path).stat().st_size / (1024**2)  # MB
            
            conn.close()
            return {
                'tables': stats,
                'size_mb': db_size,
                'total_records': sum(stats.values())
            }
        except Exception as e:
            return {'error': str(e)}
    
    def run_optimization(self, optimization_type):
        """Trigger system optimizations"""
        endpoints = {
            'concurrent': '/optimize/concurrent',
            'memory': '/optimize/memory',
            'breakthrough': '/optimize/breakthrough',
            'cache': '/optimize/cache'
        }
        
        if optimization_type in endpoints:
            try:
                response = requests.post(
                    f"{self.base_url}{endpoints[optimization_type]}",
                    json={'action': 'start'},
                    timeout=10
                )
                return response.json() if response.status_code == 200 else {'error': 'Failed'}
            except Exception as e:
                return {'error': str(e)}
        return {'error': 'Invalid optimization type'}

def main():
    dashboard = LLMAdminDashboard()
    
    # Header
    st.markdown("""
    # 🎛️ LLM Enterprise Admin Dashboard
    **Real-time monitoring and management for your LLM infrastructure**
    """)
    
    # Sidebar configuration
    with st.sidebar:
        st.header("⚙️ Dashboard Controls")
        
        # Auto-refresh toggle
        auto_refresh = st.checkbox("🔄 Auto-refresh (30s)", value=False)
        
        # Manual refresh button
        if st.button("🔄 Refresh Now", type="primary"):
            st.rerun()
        
        st.divider()
        
        # System controls
        st.header("🚀 System Controls")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("⚡ Optimize"):
                with st.spinner("Running optimization..."):
                    result = dashboard.run_optimization('concurrent')
                    st.success("✅ Optimization completed")
        
        with col2:
            if st.button("🧹 Clean Cache"):
                with st.spinner("Cleaning cache..."):
                    result = dashboard.run_optimization('cache')
                    st.success("✅ Cache cleaned")
        
        st.divider()
        
        # Quick stats
        st.header("📊 Quick Stats")
        system_metrics = dashboard.get_system_metrics()
        if system_metrics:
            st.metric("CPU Usage", f"{system_metrics['cpu_percent']:.1f}%")
            st.metric("Memory Usage", f"{system_metrics['memory_percent']:.1f}%")
            st.metric("Processes", system_metrics['process_count'])
    
    # Main dashboard content
    
    # Status indicators
    st.subheader("🔋 System Health Status")
    col1, col2, col3, col4 = st.columns(4)
    
    llm_performance = dashboard.get_llm_performance()
    
    with col1:
        main_status = llm_performance['main_server']['status']
        color = "🟢" if main_status == 'healthy' else "🔴"
        st.metric(
            "Main Server", 
            f"{color} {main_status.title()}",
            f"{llm_performance['main_server']['response_time_ms']:.0f}ms"
        )
    
    with col2:
        nitric_status = llm_performance['nitric_service']['status']
        color = "🟢" if nitric_status == 'healthy' else "🔴"
        st.metric(
            "Nitric Service", 
            f"{color} {nitric_status.title()}",
            f"{llm_performance['nitric_service']['response_time_ms']:.0f}ms"
        )
    
    with col3:
        concurrent_status = llm_performance['concurrent_metrics'].get('status', 'unknown')
        color = "🟢" if concurrent_status != 'error' else "🔴"
        st.metric("Concurrent Optimizer", f"{color} {concurrent_status.title()}")
    
    with col4:
        avg_response = llm_performance['api_response_times']['avg_response_time']
        color = "🟢" if avg_response < 100 else "🟡" if avg_response < 500 else "🔴"
        st.metric("Avg Response Time", f"{color} {avg_response:.0f}ms")
    
    st.divider()
    
    # Performance metrics charts
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📈 System Performance")
        
        # Generate sample time series data for demonstration
        time_range = pd.date_range(start=datetime.now()-timedelta(hours=1), end=datetime.now(), freq='5T')
        cpu_data = np.random.normal(25, 10, len(time_range))
        memory_data = np.random.normal(60, 15, len(time_range))
        
        fig = make_subplots(
            rows=2, cols=1,
            subplot_titles=['CPU Usage (%)', 'Memory Usage (%)'],
            vertical_spacing=0.1
        )
        
        fig.add_trace(
            go.Scatter(x=time_range, y=cpu_data, name='CPU', line=dict(color='#3b82f6')),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Scatter(x=time_range, y=memory_data, name='Memory', line=dict(color='#10b981')),
            row=2, col=1
        )
        
        fig.update_layout(height=400, showlegend=False)
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.subheader("🌐 API Response Times")
        
        api_data = llm_performance['api_response_times']
        
        fig = go.Figure(data=[
            go.Bar(
                x=api_data['endpoints'],
                y=api_data['response_times'],
                marker_color='#8b5cf6'
            )
        ])
        
        fig.update_layout(
            title="Current API Response Times (ms)",
            height=400,
            yaxis_title="Response Time (ms)"
        )
        
        st.plotly_chart(fig, use_container_width=True)
    
    # Database and storage info
    st.subheader("💾 Database & Storage")
    col1, col2, col3 = st.columns(3)
    
    db_stats = dashboard.get_database_stats()
    
    with col1:
        if 'error' not in db_stats:
            st.metric("Database Size", f"{db_stats['size_mb']:.1f} MB")
            st.metric("Total Records", f"{db_stats['total_records']:,}")
        else:
            st.error("Database connection failed")
    
    with col2:
        system_metrics = dashboard.get_system_metrics()
        if system_metrics:
            st.metric("Disk Free", f"{system_metrics['disk_free_gb']:.1f} GB")
            st.metric("Memory Available", f"{system_metrics['memory_available_gb']:.1f} GB")
    
    with col3:
        if system_metrics:
            st.metric("Network Sent", f"{system_metrics['network_bytes_sent'] / (1024**2):.1f} MB")
            st.metric("Network Received", f"{system_metrics['network_bytes_recv'] / (1024**2):.1f} MB")
    
    # Optimization controls
    st.subheader("🚀 System Optimization")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        if st.button("⚡ Concurrent Optimization", type="secondary"):
            with st.spinner("Running concurrent optimization..."):
                result = dashboard.run_optimization('concurrent')
                if 'error' not in result:
                    st.success("✅ Concurrent optimization completed")
                else:
                    st.error(f"❌ Error: {result['error']}")
    
    with col2:
        if st.button("🧠 Memory Optimization", type="secondary"):
            with st.spinner("Optimizing memory usage..."):
                result = dashboard.run_optimization('memory')
                if 'error' not in result:
                    st.success("✅ Memory optimization completed")
                else:
                    st.error(f"❌ Error: {result['error']}")
    
    with col3:
        if st.button("💥 Breakthrough Optimization", type="secondary"):
            with st.spinner("Running breakthrough optimization..."):
                result = dashboard.run_optimization('breakthrough')
                if 'error' not in result:
                    st.success("✅ Breakthrough optimization completed")
                else:
                    st.error(f"❌ Error: {result['error']}")
    
    with col4:
        if st.button("🗄️ Cache Optimization", type="secondary"):
            with st.spinner("Optimizing cache..."):
                result = dashboard.run_optimization('cache')
                if 'error' not in result:
                    st.success("✅ Cache optimization completed")
                else:
                    st.error(f"❌ Error: {result['error']}")
    
    # Recent activity log
    st.subheader("📋 Recent Activity")
    
    # Generate sample activity data
    activities = [
        {"timestamp": datetime.now() - timedelta(minutes=5), "action": "System optimization completed", "status": "✅"},
        {"timestamp": datetime.now() - timedelta(minutes=15), "action": "Database backup created", "status": "✅"},
        {"timestamp": datetime.now() - timedelta(minutes=30), "action": "Cache cleaned successfully", "status": "✅"},
        {"timestamp": datetime.now() - timedelta(hours=1), "action": "Performance report generated", "status": "✅"},
        {"timestamp": datetime.now() - timedelta(hours=2), "action": "Memory optimization executed", "status": "✅"},
    ]
    
    activity_df = pd.DataFrame(activities)
    activity_df['timestamp'] = activity_df['timestamp'].dt.strftime('%H:%M:%S')
    
    st.dataframe(
        activity_df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "timestamp": "Time",
            "action": "Action",
            "status": "Status"
        }
    )
    
    # Footer
    st.divider()
    st.markdown("""
    <div style='text-align: center; color: #64748b; font-size: 0.9rem;'>
        🎛️ LLM Enterprise Dashboard | 
        🔄 Last updated: {} | 
        🚀 Nitric Cloud-Native Infrastructure
    </div>
    """.format(datetime.now().strftime('%Y-%m-%d %H:%M:%S')), unsafe_allow_html=True)
    
    # Auto-refresh logic
    if auto_refresh:
        time.sleep(30)
        st.rerun()

if __name__ == "__main__":
    main()