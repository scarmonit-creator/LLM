#!/usr/bin/env python3

"""
🔍 Whoosh Fast Search Engine for LLM Content
Fast, pure Python search engine library for content indexing and retrieval
Implemented from awesome-python search recommendations
"""

from whoosh import index
from whoosh.fields import Schema, TEXT, ID, DATETIME, NUMERIC, KEYWORD
from whoosh.qparser import QueryParser, MultifieldParser
from whoosh.query import *
from whoosh.scoring import BM25F
from whoosh.analysis import StandardAnalyzer, StemmingAnalyzer
from whoosh.filedb.filestore import FileStorage
from whoosh.writing import AsyncWriter
from whoosh.collectors import TimeLimitCollector, WrappingCollector
from whoosh.sorting import FieldFacet
from whoosh.highlight import highlight, ContextFragmenter, HtmlFormatter

import os
import asyncio
import aiofiles
import sqlite3
import json
from datetime import datetime, timedelta
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
import time
import threading
from collections import defaultdict
import concurrent.futures
import multiprocessing as mp

logger = logging.getLogger(__name__)

@dataclass
class SearchResult:
    """Search result data structure"""
    id: str
    title: str
    content: str
    url: str
    score: float
    highlight: str
    timestamp: datetime
    category: str
    
    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'url': self.url,
            'score': self.score,
            'highlight': self.highlight,
            'timestamp': self.timestamp.isoformat(),
            'category': self.category
        }

class WhooshSearchEngine:
    """High-performance search engine using Whoosh"""
    
    def __init__(self, index_dir: str = "search_index"):
        self.index_dir = Path(index_dir)
        self.index_dir.mkdir(exist_ok=True)
        
        # Define comprehensive schema
        self.schema = Schema(
            id=ID(stored=True, unique=True),
            title=TEXT(stored=True, analyzer=StemmingAnalyzer()),
            content=TEXT(stored=True, analyzer=StandardAnalyzer()),
            url=TEXT(stored=True),
            timestamp=DATETIME(stored=True),
            category=KEYWORD(stored=True),
            score=NUMERIC(stored=True, type=float),
            tags=KEYWORD(stored=True, commas=True),
            importance=NUMERIC(stored=True, type=int)
        )
        
        self.index = None
        self.searcher = None
        self._lock = threading.RLock()
        self.stats = {
            'total_documents': 0,
            'total_searches': 0,
            'avg_search_time': 0,
            'index_size_mb': 0,
            'last_updated': None
        }
        
        # Initialize index
        self._initialize_index()
    
    def _initialize_index(self):
        """Initialize or open existing Whoosh index"""
        try:
            if index.exists_in(str(self.index_dir)):
                self.index = index.open_dir(str(self.index_dir))
                logger.info(f"✅ Opened existing search index with {self.index.doc_count()} documents")
            else:
                self.index = index.create_in(str(self.index_dir), self.schema)
                logger.info("✅ Created new search index")
            
            self._update_stats()
            
        except Exception as e:
            logger.error(f"❌ Error initializing search index: {e}")
            raise
    
    def _update_stats(self):
        """Update index statistics"""
        try:
            self.stats['total_documents'] = self.index.doc_count()
            
            # Calculate index size
            total_size = sum(f.stat().st_size for f in self.index_dir.rglob('*') if f.is_file())
            self.stats['index_size_mb'] = total_size / (1024 * 1024)
            self.stats['last_updated'] = datetime.now()
            
        except Exception as e:
            logger.error(f"Error updating stats: {e}")
    
    async def add_document(self, doc_id: str, title: str, content: str, 
                          url: str = "", category: str = "general", 
                          tags: List[str] = None, importance: int = 1):
        """Add document to search index"""
        try:
            with self._lock:
                writer = self.index.writer()
                
                # Prepare document
                doc_data = {
                    'id': doc_id,
                    'title': title,
                    'content': content,
                    'url': url,
                    'timestamp': datetime.now(),
                    'category': category,
                    'score': 0.0,
                    'tags': ','.join(tags) if tags else '',
                    'importance': importance
                }
                
                # Add or update document
                writer.update_document(**doc_data)
                writer.commit()
                
                logger.info(f"✅ Added document: {doc_id}")
                self._update_stats()
                
        except Exception as e:
            logger.error(f"❌ Error adding document {doc_id}: {e}")
            raise
    
    async def add_documents_bulk(self, documents: List[Dict]):
        """Add multiple documents efficiently"""
        try:
            with self._lock:
                writer = self.index.writer()
                
                for doc in documents:
                    doc_data = {
                        'id': doc.get('id', f"doc_{int(time.time())}_{hash(doc.get('title', ''))}"),
                        'title': doc.get('title', ''),
                        'content': doc.get('content', ''),
                        'url': doc.get('url', ''),
                        'timestamp': datetime.now(),
                        'category': doc.get('category', 'general'),
                        'score': 0.0,
                        'tags': ','.join(doc.get('tags', [])),
                        'importance': doc.get('importance', 1)
                    }
                    
                    writer.add_document(**doc_data)
                
                writer.commit()
                
                logger.info(f"✅ Added {len(documents)} documents to search index")
                self._update_stats()
                
        except Exception as e:
            logger.error(f"❌ Error adding bulk documents: {e}")
            raise
    
    async def search(self, query_text: str, limit: int = 20, 
                    category_filter: Optional[str] = None,
                    time_filter: Optional[timedelta] = None) -> List[SearchResult]:
        """Perform fast search with advanced filtering"""
        start_time = time.time()
        
        try:
            with self._lock:
                with self.index.searcher(weighting=BM25F()) as searcher:
                    # Create multi-field parser
                    parser = MultifieldParser(['title', 'content', 'tags'], self.index.schema)
                    
                    # Parse query
                    query = parser.parse(query_text)
                    
                    # Add filters
                    if category_filter:
                        category_query = Term('category', category_filter)
                        query = And([query, category_query])
                    
                    if time_filter:
                        cutoff_time = datetime.now() - time_filter
                        time_query = DateRange('timestamp', cutoff_time, datetime.now())
                        query = And([query, time_query])
                    
                    # Perform search with time limit
                    collector = TimeLimitCollector(searcher.collector(limit=limit), timelimit=2.0)
                    
                    try:
                        results = searcher.search_with_collector(query, collector)
                    except:
                        # Fallback to regular search if time limit exceeded
                        results = searcher.search(query, limit=limit)
                    
                    # Process results
                    search_results = []
                    formatter = HtmlFormatter(tagname="mark", classname="highlight")
                    fragmenter = ContextFragmenter(maxchars=200, surround=50)
                    
                    for hit in results:
                        # Generate highlight
                        highlight_text = hit.highlights('content', top=3)
                        if not highlight_text:
                            highlight_text = hit['content'][:200] + "..." if len(hit['content']) > 200 else hit['content']
                        
                        search_results.append(SearchResult(
                            id=hit['id'],
                            title=hit['title'],
                            content=hit['content'],
                            url=hit['url'],
                            score=hit.score,
                            highlight=highlight_text,
                            timestamp=hit['timestamp'],
                            category=hit['category']
                        ))
                    
                    # Update statistics
                    search_time = (time.time() - start_time) * 1000
                    self.stats['total_searches'] += 1
                    self.stats['avg_search_time'] = (
                        (self.stats['avg_search_time'] * (self.stats['total_searches'] - 1) + search_time) /
                        self.stats['total_searches']
                    )
                    
                    logger.info(
                        f"🔍 Search completed: '{query_text}' -> {len(search_results)} results in {search_time:.2f}ms"
                    )
                    
                    return search_results
                    
        except Exception as e:
            logger.error(f"❌ Search error: {e}")
            return []
    
    async def search_similar(self, document_id: str, limit: int = 10) -> List[SearchResult]:
        """Find documents similar to the given document"""
        try:
            with self._lock:
                with self.index.searcher() as searcher:
                    # Get the original document
                    doc = searcher.document(id=document_id)
                    if not doc:
                        return []
                    
                    # Use title and content for similarity
                    similar_query = f"\"{doc['title']}\" OR ({doc['content'][:200]})"
                    
                    return await self.search(similar_query, limit=limit)
                    
        except Exception as e:
            logger.error(f"❌ Similar search error: {e}")
            return []
    
    async def get_suggestions(self, partial_query: str, limit: int = 5) -> List[str]:
        """Get search suggestions based on partial input"""
        try:
            with self._lock:
                with self.index.searcher() as searcher:
                    # Create wildcard query
                    query = Wildcard('title', f"{partial_query}*")
                    results = searcher.search(query, limit=limit)
                    
                    suggestions = [hit['title'] for hit in results]
                    return suggestions
                    
        except Exception as e:
            logger.error(f"❌ Suggestion error: {e}")
            return []
    
    async def delete_document(self, doc_id: str):
        """Delete document from index"""
        try:
            with self._lock:
                writer = self.index.writer()
                writer.delete_by_term('id', doc_id)
                writer.commit()
                
                logger.info(f"✅ Deleted document: {doc_id}")
                self._update_stats()
                
        except Exception as e:
            logger.error(f"❌ Error deleting document {doc_id}: {e}")
            raise
    
    async def optimize_index(self):
        """Optimize search index for better performance"""
        try:
            with self._lock:
                writer = self.index.writer()
                writer.mergetype = 'OPTIMIZE'
                writer.commit(optimize=True)
                
                logger.info("✅ Search index optimized")
                self._update_stats()
                
        except Exception as e:
            logger.error(f"❌ Index optimization error: {e}")
            raise
    
    async def index_browser_history(self, db_path: str = "browser_history.db"):
        """Index browser history data for search"""
        try:
            if not Path(db_path).exists():
                logger.warning(f"Database not found: {db_path}")
                return
            
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Get all history entries
            cursor.execute("""
                SELECT id, url, title, timestamp 
                FROM history 
                ORDER BY timestamp DESC
            """)
            
            rows = cursor.fetchall()
            conn.close()
            
            # Prepare documents for indexing
            documents = []
            for row in rows:
                doc_id, url, title, timestamp = row
                documents.append({
                    'id': f"history_{doc_id}",
                    'title': title or 'Untitled',
                    'content': f"{title} {url}",
                    'url': url,
                    'category': 'browser_history',
                    'importance': 2
                })
            
            # Add documents in batches
            batch_size = 100
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                await self.add_documents_bulk(batch)
                
                # Brief pause to avoid blocking
                await asyncio.sleep(0.1)
            
            logger.info(f"✅ Indexed {len(documents)} browser history entries")
            
        except Exception as e:
            logger.error(f"❌ Error indexing browser history: {e}")
            raise
    
    async def index_llm_conversations(self, conversations: List[Dict]):
        """Index LLM conversation data"""
        try:
            documents = []
            
            for conv in conversations:
                doc_id = f"conv_{conv.get('id', int(time.time()))}"
                documents.append({
                    'id': doc_id,
                    'title': conv.get('title', 'LLM Conversation'),
                    'content': conv.get('content', ''),
                    'url': conv.get('url', ''),
                    'category': 'llm_conversation',
                    'tags': conv.get('tags', []),
                    'importance': conv.get('importance', 3)
                })
            
            await self.add_documents_bulk(documents)
            logger.info(f"✅ Indexed {len(documents)} LLM conversations")
            
        except Exception as e:
            logger.error(f"❌ Error indexing conversations: {e}")
            raise
    
    def get_stats(self) -> Dict:
        """Get search engine statistics"""
        self._update_stats()
        return {
            **self.stats,
            'status': 'active',
            'index_path': str(self.index_dir)
        }
    
    async def faceted_search(self, query_text: str, facets: List[str] = None, 
                            limit: int = 20) -> Dict:
        """Perform faceted search with grouping"""
        try:
            if not facets:
                facets = ['category']
            
            with self._lock:
                with self.index.searcher() as searcher:
                    parser = MultifieldParser(['title', 'content'], self.index.schema)
                    query = parser.parse(query_text)
                    
                    # Perform search with faceting
                    facet_objects = [FieldFacet(facet) for facet in facets]
                    results = searcher.search(query, limit=limit, groupedby=facet_objects)
                    
                    # Process results
                    search_results = []
                    for hit in results:
                        search_results.append(SearchResult(
                            id=hit['id'],
                            title=hit['title'],
                            content=hit['content'],
                            url=hit['url'],
                            score=hit.score,
                            highlight=hit.highlights('content') or hit['content'][:200],
                            timestamp=hit['timestamp'],
                            category=hit['category']
                        ).to_dict())
                    
                    # Get facet counts
                    facet_counts = {}
                    for facet in facets:
                        if facet in results.facet_names():
                            facet_counts[facet] = dict(results.groups(facet))
                    
                    return {
                        'results': search_results,
                        'total': len(search_results),
                        'facets': facet_counts,
                        'query': query_text
                    }
                    
        except Exception as e:
            logger.error(f"❌ Faceted search error: {e}")
            return {'results': [], 'total': 0, 'facets': {}, 'error': str(e)}
    
    async def auto_complete(self, partial_text: str, field: str = 'title', 
                           limit: int = 10) -> List[str]:
        """Auto-complete suggestions"""
        try:
            with self._lock:
                with self.index.searcher() as searcher:
                    # Use prefix query for auto-complete
                    query = Prefix(field, partial_text)
                    results = searcher.search(query, limit=limit)
                    
                    suggestions = list(set(hit[field] for hit in results if hit[field]))
                    suggestions.sort()
                    
                    return suggestions[:limit]
                    
        except Exception as e:
            logger.error(f"❌ Auto-complete error: {e}")
            return []
    
    async def trending_searches(self, days: int = 7, limit: int = 10) -> List[Dict]:
        """Get trending search terms (placeholder implementation)"""
        # In a real implementation, you'd track search queries
        # This is a simplified version
        
        trending = [
            {"term": "machine learning", "count": 45, "growth": "20%"},
            {"term": "fastapi", "count": 38, "growth": "15%"},
            {"term": "async python", "count": 32, "growth": "25%"},
            {"term": "optimization", "count": 28, "growth": "10%"},
            {"term": "streamlit dashboard", "count": 24, "growth": "30%"}
        ]
        
        return trending[:limit]
    
    async def rebuild_index(self):
        """Rebuild entire search index"""
        try:
            logger.info("🔄 Rebuilding search index...")
            
            # Close current index
            if self.index:
                self.index.close()
            
            # Remove old index
            import shutil
            if self.index_dir.exists():
                shutil.rmtree(str(self.index_dir))
            
            # Recreate index
            self._initialize_index()
            
            # Re-index data sources
            await self.index_browser_history()
            
            logger.info("✅ Search index rebuilt successfully")
            
        except Exception as e:
            logger.error(f"❌ Index rebuild error: {e}")
            raise
    
    def close(self):
        """Close search engine and cleanup resources"""
        try:
            if self.index:
                self.index.close()
            logger.info("✅ Search engine closed")
        except Exception as e:
            logger.error(f"❌ Error closing search engine: {e}")

# Singleton instance
_search_engine = None

def get_search_engine() -> WhooshSearchEngine:
    """Get singleton search engine instance"""
    global _search_engine
    if _search_engine is None:
        _search_engine = WhooshSearchEngine()
    return _search_engine

# FastAPI integration functions
async def initialize_search_system():
    """Initialize search system for FastAPI"""
    search_engine = get_search_engine()
    
    # Index existing data
    try:
        await search_engine.index_browser_history()
        logger.info("✅ Search system initialized")
    except Exception as e:
        logger.error(f"❌ Search system initialization failed: {e}")

# CLI interface for testing
if __name__ == "__main__":
    import sys
    
    async def main():
        engine = WhooshSearchEngine()
        
        if len(sys.argv) > 1:
            command = sys.argv[1]
            
            if command == "index":
                await engine.index_browser_history()
                print("✅ Browser history indexed")
                
            elif command == "search":
                if len(sys.argv) > 2:
                    query = " ".join(sys.argv[2:])
                    results = await engine.search(query)
                    
                    print(f"\n🔍 Search results for: '{query}'")
                    print("=" * 50)
                    
                    for i, result in enumerate(results[:5], 1):
                        print(f"{i}. {result.title}")
                        print(f"   Score: {result.score:.2f}")
                        print(f"   URL: {result.url}")
                        print(f"   Highlight: {result.highlight[:100]}...")
                        print()
                else:
                    print("Usage: python whoosh-engine.py search <query>")
                    
            elif command == "stats":
                stats = engine.get_stats()
                print(json.dumps(stats, indent=2, default=str))
                
            elif command == "optimize":
                await engine.optimize_index()
                print("✅ Index optimized")
                
            else:
                print("Usage: python whoosh-engine.py [index|search|stats|optimize]")
        else:
            print("Whoosh Search Engine for LLM System")
            print("Commands: index, search <query>, stats, optimize")
    
    asyncio.run(main())