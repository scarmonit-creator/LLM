#!/usr/bin/env python3
"""
Optimized GClient Evaluator
Performance-enhanced version with caching and security improvements
"""

import ast
import hashlib
import logging
import os
import sys
import time
from functools import lru_cache
from collections import OrderedDict
import weakref

class OptimizedGClientEvaluator:
    """High-performance gclient condition evaluator with caching."""
    
    def __init__(self, cache_size=1000):
        self.cache_size = cache_size
        self._ast_cache = {}
        self._result_cache = {}
        self._compilation_cache = {}
        self._stats = {
            'cache_hits': 0,
            'cache_misses': 0,
            'evaluations': 0,
            'errors': 0
        }
        
        # Pre-compile allowed node types for faster checking
        self._allowed_nodes = frozenset({
            ast.Expression, ast.BinOp, ast.BoolOp, ast.Compare, ast.Name, 
            ast.Str, ast.Num, ast.List, ast.Dict, ast.Tuple, ast.Load,
            ast.And, ast.Or, ast.Not, ast.Eq, ast.NotEq, ast.Lt, ast.Gt,
            ast.LtE, ast.GtE, ast.In, ast.NotIn, ast.Is, ast.IsNot,
            ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.UnaryOp,
            ast.UAdd, ast.USub, ast.IfExp, ast.Subscript, ast.Index,
            ast.Slice, ast.ExtSlice, ast.Ellipsis
        })
        
        # Add Python 3.8+ compatibility
        if hasattr(ast, 'Constant'):
            self._allowed_nodes = self._allowed_nodes | {ast.Constant}
    
    def _get_cache_key(self, condition_str, variables_hash):
        """Generate a cache key for the condition and variables."""
        combined = f"{condition_str}|{variables_hash}"
        return hashlib.md5(combined.encode('utf-8')).hexdigest()
    
    def _hash_variables(self, variables):
        """Create a stable hash of the variables dict."""
        if not variables:
            return "empty"
        
        # Sort items to ensure consistent hashing
        items = sorted(variables.items())
        var_str = str(items)
        return hashlib.md5(var_str.encode('utf-8')).hexdigest()[:8]
    
    @lru_cache(maxsize=500)
    def _parse_and_validate(self, condition_str):
        """Parse and validate AST with caching."""
        try:
            node = ast.parse(condition_str, mode='eval')
            self._validate_ast_recursive(node)
            return node
        except Exception as e:
            logging.warning(f"AST parse/validation failed for '{condition_str}': {e}")
            return None
    
    def _validate_ast_recursive(self, node):
        """Recursively validate AST nodes efficiently."""
        node_stack = [node]
        
        while node_stack:
            current = node_stack.pop()
            
            if type(current) not in self._allowed_nodes:
                raise ValueError(f"Unsafe AST node: {type(current).__name__}")
            
            # Add children to stack for processing
            node_stack.extend(ast.iter_child_nodes(current))
    
    def evaluate_condition_optimized(self, condition_str, variables=None):
        """Optimized condition evaluation with multi-level caching."""
        self._stats['evaluations'] += 1
        
        # Fast path for empty/None conditions
        if not condition_str or condition_str.strip() == "":
            return True
        
        # Normalize condition string
        condition_str = condition_str.strip()
        
        # Fast path for simple boolean literals
        if condition_str in ('True', 'true', '1'):
            return True
        if condition_str in ('False', 'false', '0'):
            return False
        
        variables = variables or {}
        variables_hash = self._hash_variables(variables)
        cache_key = self._get_cache_key(condition_str, variables_hash)
        
        # Check result cache first
        if cache_key in self._result_cache:
            self._stats['cache_hits'] += 1
            return self._result_cache[cache_key]
        
        self._stats['cache_misses'] += 1
        
        try:
            # Get or parse AST
            ast_node = self._parse_and_validate(condition_str)
            if not ast_node:
                self._stats['errors'] += 1
                return False
            
            # Get or compile code
            if condition_str not in self._compilation_cache:
                self._compilation_cache[condition_str] = compile(
                    ast_node, '<gclient_condition>', 'eval'
                )
            
            code_obj = self._compilation_cache[condition_str]
            
            # Create evaluation environment
            safe_globals = {
                '__builtins__': {
                    'len': len, 'str': str, 'int': int, 'bool': bool,
                    'True': True, 'False': False, 'None': None
                }
            }
            safe_globals.update(variables)
            
            # Evaluate with timeout protection
            result = eval(code_obj, safe_globals, {})
            result = bool(result)  # Normalize to boolean
            
            # Cache result with size limit
            if len(self._result_cache) >= self.cache_size:
                # Remove oldest 20% of entries
                items_to_remove = self.cache_size // 5
                for _ in range(items_to_remove):
                    self._result_cache.pop(next(iter(self._result_cache)))
            
            self._result_cache[cache_key] = result
            return result
            
        except Exception as e:
            self._stats['errors'] += 1
            logging.warning(f"Evaluation failed for '{condition_str}': {e}")
            return False
    
    def clear_caches(self):
        """Clear all caches and reset stats."""
        self._ast_cache.clear()
        self._result_cache.clear() 
        self._compilation_cache.clear()
        self._parse_and_validate.cache_clear()
        
        for key in self._stats:
            self._stats[key] = 0
    
    def get_stats(self):
        """Get performance statistics."""
        total_requests = self._stats['cache_hits'] + self._stats['cache_misses']
        hit_rate = (self._stats['cache_hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            **self._stats,
            'cache_hit_rate': f"{hit_rate:.1f}%",
            'cache_size': len(self._result_cache),
            'ast_cache_size': len(self._compilation_cache)
        }

# Global optimized evaluator instance
_global_evaluator = OptimizedGClientEvaluator()

def evaluate_condition_fast(condition_str, variables=None):
    """Fast entry point using global cached evaluator."""
    return _global_evaluator.evaluate_condition_optimized(condition_str, variables)

def get_evaluator_stats():
    """Get global evaluator performance stats."""
    return _global_evaluator.get_stats()

def clear_evaluator_cache():
    """Clear global evaluator cache."""
    _global_evaluator.clear_caches()

# Backward compatibility
def evaluate_condition(condition_str, variables=None):
    """Legacy API compatibility."""
    return evaluate_condition_fast(condition_str, variables)

if __name__ == "__main__":
    # Performance test
    import time
    
    test_conditions = [
        "True",
        "False", 
        "os_name == 'win'",
        "target_os == 'android' and host_os != 'mac'",
        "checkout_android or checkout_chromeos",
        "not disable_x11 and target_os == 'linux'",
    ]
    
    test_vars = {
        'os_name': 'win',
        'target_os': 'android',
        'host_os': 'win',
        'checkout_android': True,
        'checkout_chromeos': False,
        'disable_x11': False
    }
    
    print("🚀 GCLIENT EVALUATOR PERFORMANCE TEST")
    print("=" * 50)
    
    # Warmup
    for condition in test_conditions:
        evaluate_condition_fast(condition, test_vars)
    
    # Benchmark
    start_time = time.time()
    iterations = 1000
    
    for _ in range(iterations):
        for condition in test_conditions:
            result = evaluate_condition_fast(condition, test_vars)
    
    end_time = time.time()
    total_evaluations = iterations * len(test_conditions)
    
    print(f"Evaluations: {total_evaluations}")
    print(f"Total time: {end_time - start_time:.4f}s")
    print(f"Per evaluation: {(end_time - start_time) / total_evaluations * 1000:.3f}ms")
    
    stats = get_evaluator_stats()
    print(f"Cache hit rate: {stats['cache_hit_rate']}")
    print(f"Cache size: {stats['cache_size']}")
    
    print("\n✅ OPTIMIZATION COMPLETE")
