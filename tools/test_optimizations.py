#!/usr/bin/env python3
"""
Test harness for depot tools optimizations
"""

import subprocess
import sys
import time
import os

def run_optimization_tests():
    """Run comprehensive optimization tests."""
    print("🧪 DEPOT TOOLS OPTIMIZATION TEST SUITE")
    print("=" * 50)
    
    tests = [
        ("depot_tools_optimizer.py", "Comprehensive optimization suite"),
        ("optimized_gclient_eval.py", "GClient evaluator performance test"),
        ("git_performance_monitor.py", "Git performance monitoring"),
    ]
    
    results = []
    
    for script, description in tests:
        if os.path.exists(script):
            print(f"\n🏃 Running: {description}")
            print("-" * 30)
            
            start_time = time.time()
            try:
                result = subprocess.run(
                    [sys.executable, script],
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                
                end_time = time.time()
                
                if result.returncode == 0:
                    print(f"✅ PASSED ({end_time - start_time:.2f}s)")
                    results.append(('PASS', script, end_time - start_time))
                else:
                    print(f"❌ FAILED ({end_time - start_time:.2f}s)")
                    print(f"Error: {result.stderr[:200]}")
                    results.append(('FAIL', script, end_time - start_time))
                    
            except subprocess.TimeoutExpired:
                print("⏱️  TIMEOUT (120s)")
                results.append(('TIMEOUT', script, 120))
            except Exception as e:
                print(f"💥 EXCEPTION: {e}")
                results.append(('ERROR', script, 0))
        else:
            print(f"⚠️  Script not found: {script}")
            results.append(('MISSING', script, 0))
    
    # Summary
    print("\n📊 TEST RESULTS SUMMARY")
    print("=" * 30)
    
    total_time = 0
    for status, script, duration in results:
        emoji = {"PASS": "✅", "FAIL": "❌", "TIMEOUT": "⏱️", "ERROR": "💥", "MISSING": "⚠️"}
        print(f"{emoji[status]} {script}: {status} ({duration:.2f}s)")
        total_time += duration
    
    passed = sum(1 for r in results if r[0] == 'PASS')
    total = len(results)
    
    print(f"\n🎯 RESULTS: {passed}/{total} tests passed")
    print(f"⏱️  Total time: {total_time:.2f}s")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Optimizations are working correctly.")
    else:
        print("⚠️  Some tests failed. Check output above for details.")
    
    return passed == total

if __name__ == "__main__":
    success = run_optimization_tests()
    sys.exit(0 if success else 1)
