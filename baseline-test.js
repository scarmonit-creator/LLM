// baseline-test.js - Performance Testing with ES6 Imports
import { performance } from 'perf_hooks';
import { strict as assert } from 'assert';

/**
 * Performance baseline testing utilities
 * Uses ES6 imports for compatibility with modern CI/CD workflows
 */

class PerformanceTest {
  constructor(name) {
    this.name = name;
    this.startTime = null;
    this.endTime = null;
    this.results = [];
  }

  start() {
    this.startTime = performance.now();
  }

  end() {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    this.results.push(duration);
    return duration;
  }

  getAverageDuration() {
    if (this.results.length === 0) return 0;
    const sum = this.results.reduce((acc, val) => acc + val, 0);
    return sum / this.results.length;
  }

  reset() {
    this.startTime = null;
    this.endTime = null;
    this.results = [];
  }
}

/**
 * Run a performance test with a given function
 * @param {string} testName - Name of the test
 * @param {Function} testFn - Function to test
 * @param {number} iterations - Number of iterations to run
 * @returns {Object} Test results
 */
export async function runPerformanceTest(testName, testFn, iterations = 100) {
  const test = new PerformanceTest(testName);
  
  console.log(`\nRunning performance test: ${testName}`);
  console.log(`Iterations: ${iterations}`);
  
  for (let i = 0; i < iterations; i++) {
    test.start();
    await testFn();
    test.end();
  }
  
  const avgDuration = test.getAverageDuration();
  const maxDuration = Math.max(...test.results);
  const minDuration = Math.min(...test.results);
  
  const results = {
    testName,
    iterations,
    avgDuration: avgDuration.toFixed(3),
    maxDuration: maxDuration.toFixed(3),
    minDuration: minDuration.toFixed(3)
  };
  
  console.log(`Average Duration: ${results.avgDuration}ms`);
  console.log(`Max Duration: ${results.maxDuration}ms`);
  console.log(`Min Duration: ${results.minDuration}ms`);
  
  return results;
}

/**
 * Assert that performance meets baseline threshold
 * @param {number} duration - Duration in milliseconds
 * @param {number} threshold - Maximum acceptable duration
 */
export function assertPerformanceThreshold(duration, threshold) {
  assert.ok(
    duration <= threshold,
    `Performance test failed: ${duration}ms exceeds threshold of ${threshold}ms`
  );
}

/**
 * Example baseline test
 */
export async function exampleBaselineTest() {
  const results = await runPerformanceTest(
    'Example Operation',
    async () => {
      // Simulate some async operation
      await new Promise(resolve => setTimeout(resolve, 1));
    },
    50
  );
  
  // Assert performance meets baseline
  assertPerformanceThreshold(parseFloat(results.avgDuration), 10);
  
  return results;
}

export default {
  runPerformanceTest,
  assertPerformanceThreshold,
  exampleBaselineTest,
  PerformanceTest
};
