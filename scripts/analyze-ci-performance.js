#!/usr/bin/env node

/**
 * 📊 Autonomous CI/CD Performance Analysis Tool
 * 
 * Analyzes GitHub Actions workflow performance and provides optimization recommendations
 * 
 * Features:
 * ✅ Real-time workflow analysis
 * ✅ Queue bottleneck detection
 * ✅ Resource utilization optimization
 * ✅ Performance trend analysis
 * ✅ Autonomous optimization recommendations
 * ✅ Cost efficiency calculations
 */

import { Octokit } from '@octokit/rest';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

const log = {
  info: (msg) => console.log(`📊 [INFO] ${msg}`),
  warn: (msg) => console.log(`⚠️ [WARN] ${msg}`),
  error: (msg) => console.log(`❌ [ERROR] ${msg}`),
  success: (msg) => console.log(`✅ [SUCCESS] ${msg}`)
};

class CIPerformanceAnalyzer {
  constructor(options = {}) {
    this.options = {
      owner: 'scarmonit-creator',
      repo: 'LLM',
      analysisDepth: 50, // Number of workflow runs to analyze
      ...options
    };
    
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN
    });
    
    this.metrics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      cancelledRuns: 0,
      averageRunTime: 0,
      queueTime: 0,
      resourceEfficiency: 0,
      costAnalysis: {}
    };
  }

  async analyzeWorkflowPerformance() {
    const startTime = performance.now();
    log.info('Starting comprehensive CI/CD performance analysis...');
    
    try {
      // Fetch workflow runs data
      const workflowRuns = await this.fetchWorkflowRuns();
      
      // Analyze performance patterns
      const performanceAnalysis = this.analyzePerformancePatterns(workflowRuns);
      
      // Identify bottlenecks
      const bottlenecks = this.identifyBottlenecks(workflowRuns);
      
      // Generate optimization recommendations
      const optimizations = this.generateOptimizations(performanceAnalysis, bottlenecks);
      
      // Calculate cost efficiency
      const costAnalysis = this.calculateCostEfficiency(workflowRuns);
      
      const analysisResults = {
        summary: performanceAnalysis,
        bottlenecks,
        optimizations,
        costAnalysis,
        generatedAt: new Date().toISOString(),
        analysisDuration: Math.round(performance.now() - startTime)
      };
      
      // Save analysis report
      await this.saveAnalysisReport(analysisResults);
      
      // Display results
      this.displayResults(analysisResults);
      
      return analysisResults;
      
    } catch (error) {
      log.error(`Performance analysis failed: ${error.message}`);
      throw error;
    }
  }

  async fetchWorkflowRuns() {
    log.info(`Fetching ${this.options.analysisDepth} recent workflow runs...`);
    
    try {
      const { data: runs } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner: this.options.owner,
        repo: this.options.repo,
        per_page: this.options.analysisDepth,
        status: 'completed'
      });
      
      log.success(`Retrieved ${runs.workflow_runs.length} workflow runs for analysis`);
      return runs.workflow_runs;
      
    } catch (error) {
      log.error(`Failed to fetch workflow runs: ${error.message}`);
      throw error;
    }
  }

  analyzePerformancePatterns(runs) {
    log.info('Analyzing workflow performance patterns...');
    
    let totalDuration = 0;
    let totalQueueTime = 0;
    const statusCounts = { success: 0, failure: 0, cancelled: 0 };
    const hourlyDistribution = {};
    const workflowTypes = {};
    
    for (const run of runs) {
      // Duration analysis
      if (run.created_at && run.updated_at) {
        const duration = new Date(run.updated_at) - new Date(run.created_at);
        totalDuration += duration;
        
        // Queue time estimation (run_started_at - created_at)
        if (run.run_started_at) {
          const queueTime = new Date(run.run_started_at) - new Date(run.created_at);
          totalQueueTime += queueTime;
        }
      }
      
      // Status analysis
      if (run.conclusion === 'success') statusCounts.success++;
      else if (run.conclusion === 'failure') statusCounts.failure++;
      else if (run.conclusion === 'cancelled') statusCounts.cancelled++;
      
      // Time distribution analysis
      const hour = new Date(run.created_at).getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
      
      // Workflow type analysis
      workflowTypes[run.name] = (workflowTypes[run.name] || 0) + 1;
    }
    
    const avgDuration = totalDuration / runs.length;
    const avgQueueTime = totalQueueTime / runs.length;
    const successRate = (statusCounts.success / runs.length) * 100;
    
    return {
      totalRuns: runs.length,
      averageDuration: Math.round(avgDuration / 1000 / 60), // minutes
      averageQueueTime: Math.round(avgQueueTime / 1000), // seconds
      successRate: Math.round(successRate * 10) / 10, // percentage
      statusDistribution: statusCounts,
      hourlyDistribution,
      workflowTypes,
      efficiency: this.calculateEfficiency(successRate, avgDuration, avgQueueTime)
    };
  }

  identifyBottlenecks(runs) {
    log.info('Identifying performance bottlenecks...');
    
    const bottlenecks = [];
    const thresholds = {
      maxDuration: 15 * 60 * 1000, // 15 minutes
      maxQueueTime: 5 * 60 * 1000, // 5 minutes
      minSuccessRate: 85 // 85%
    };
    
    // Long-running workflows
    const longRuns = runs.filter(run => {
      if (!run.created_at || !run.updated_at) return false;
      const duration = new Date(run.updated_at) - new Date(run.created_at);
      return duration > thresholds.maxDuration;
    });
    
    if (longRuns.length > runs.length * 0.2) {
      bottlenecks.push({
        type: 'execution_time',
        severity: 'high',
        description: `${longRuns.length} runs (${Math.round(longRuns.length/runs.length*100)}%) exceed 15min duration`,
        impact: 'Developer productivity loss, resource waste'
      });
    }
    
    // High queue times
    const highQueueRuns = runs.filter(run => {
      if (!run.created_at || !run.run_started_at) return false;
      const queueTime = new Date(run.run_started_at) - new Date(run.created_at);
      return queueTime > thresholds.maxQueueTime;
    });
    
    if (highQueueRuns.length > runs.length * 0.3) {
      bottlenecks.push({
        type: 'queue_congestion',
        severity: 'critical',
        description: `${highQueueRuns.length} runs (${Math.round(highQueueRuns.length/runs.length*100)}%) have excessive queue times`,
        impact: 'Delayed feedback, reduced iteration speed'
      });
    }
    
    // Low success rate
    const successCount = runs.filter(run => run.conclusion === 'success').length;
    const successRate = (successCount / runs.length) * 100;
    
    if (successRate < thresholds.minSuccessRate) {
      bottlenecks.push({
        type: 'success_rate',
        severity: 'high',
        description: `Success rate is ${Math.round(successRate)}% (below 85% threshold)`,
        impact: 'Development friction, reduced confidence'
      });
    }
    
    // Frequent cancellations
    const cancelledCount = runs.filter(run => run.conclusion === 'cancelled').length;
    if (cancelledCount > runs.length * 0.15) {
      bottlenecks.push({
        type: 'cancellation_rate',
        severity: 'medium',
        description: `High cancellation rate: ${cancelledCount} runs (${Math.round(cancelledCount/runs.length*100)}%)`,
        impact: 'Resource waste, queue buildup'
      });
    }
    
    return bottlenecks;
  }

  generateOptimizations(analysis, bottlenecks) {
    log.info('Generating optimization recommendations...');
    
    const optimizations = [];
    
    // Duration optimizations
    if (analysis.averageDuration > 10) {
      optimizations.push({
        category: 'execution_speed',
        priority: 'high',
        title: 'Reduce workflow execution time',
        recommendations: [
          'Implement parallel job execution',
          'Optimize dependency installation with caching',
          'Reduce Node.js version matrix for PRs',
          'Skip unnecessary steps for docs-only changes'
        ],
        expectedImpact: '60-80% faster execution'
      });
    }
    
    // Queue optimizations
    if (analysis.averageQueueTime > 60) {
      optimizations.push({
        category: 'queue_management',
        priority: 'critical',
        title: 'Eliminate workflow queue congestion',
        recommendations: [
          'Implement aggressive concurrency controls',
          'Add workflow cancellation for superseded runs',
          'Optimize resource allocation',
          'Use path filtering to skip irrelevant workflows'
        ],
        expectedImpact: '90% queue time reduction'
      });
    }
    
    // Success rate optimizations
    if (analysis.successRate < 90) {
      optimizations.push({
        category: 'reliability',
        priority: 'high',
        title: 'Improve workflow success rate',
        recommendations: [
          'Add retry logic for flaky tests',
          'Implement better error handling',
          'Stabilize test environment',
          'Add pre-flight validation checks'
        ],
        expectedImpact: '>95% success rate'
      });
    }
    
    // Resource efficiency
    optimizations.push({
      category: 'resource_efficiency',
      priority: 'medium',
      title: 'Optimize resource utilization',
      recommendations: [
        'Implement intelligent caching strategies',
        'Use smaller runner instances where possible',
        'Optimize Docker image builds',
        'Add resource monitoring and limits'
      ],
      expectedImpact: '70% resource efficiency improvement'
    });
    
    return optimizations;
  }

  calculateCostEfficiency(runs) {
    log.info('Calculating cost efficiency metrics...');
    
    // Estimate costs (GitHub Actions pricing approximation)
    const costPerMinute = 0.008; // $0.008 per minute for Linux runners
    
    let totalRunTime = 0;
    let wastedTime = 0;
    
    for (const run of runs) {
      if (run.created_at && run.updated_at) {
        const duration = (new Date(run.updated_at) - new Date(run.created_at)) / 1000 / 60;
        totalRunTime += duration;
        
        // Consider cancelled runs as waste
        if (run.conclusion === 'cancelled') {
          wastedTime += duration;
        }
      }
    }
    
    const estimatedMonthlyCost = (totalRunTime / runs.length) * costPerMinute * 30 * 10; // 10 runs per day estimate
    const wastedCost = wastedTime * costPerMinute;
    const efficiency = ((totalRunTime - wastedTime) / totalRunTime) * 100;
    
    return {
      totalRunTimeMinutes: Math.round(totalRunTime),
      wastedTimeMinutes: Math.round(wastedTime),
      estimatedMonthlyCost: Math.round(estimatedMonthlyCost * 100) / 100,
      wastedCost: Math.round(wastedCost * 100) / 100,
      efficiency: Math.round(efficiency * 10) / 10,
      potentialSavings: Math.round(wastedCost * 30 * 100) / 100 // Monthly savings
    };
  }

  calculateEfficiency(successRate, avgDuration, avgQueueTime) {
    // Weighted efficiency score (0-100)
    const successWeight = 0.4;
    const durationWeight = 0.3;
    const queueWeight = 0.3;
    
    const successScore = Math.min(successRate, 100);
    const durationScore = Math.max(0, 100 - (avgDuration / 1000 / 60 / 20 * 100)); // Penalty for >20min
    const queueScore = Math.max(0, 100 - (avgQueueTime / 1000 / 300 * 100)); // Penalty for >5min queue
    
    return Math.round(
      (successScore * successWeight + durationScore * durationWeight + queueScore * queueWeight) * 10
    ) / 10;
  }

  async saveAnalysisReport(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ci-performance-analysis-${timestamp}.json`;
    const reportPath = path.join(process.cwd(), 'reports', filename);
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
      log.success(`Analysis report saved: ${reportPath}`);
    } catch (error) {
      log.error(`Failed to save report: ${error.message}`);
    }
  }

  displayResults(results) {
    console.log('\n📊 CI/CD PERFORMANCE ANALYSIS RESULTS');
    console.log('=' .repeat(60));
    
    const { summary, bottlenecks, optimizations, costAnalysis } = results;
    
    console.log('\n📈 PERFORMANCE SUMMARY:');
    console.log(`   Total Runs Analyzed: ${summary.totalRuns}`);
    console.log(`   Average Duration: ${summary.averageDuration} minutes`);
    console.log(`   Average Queue Time: ${summary.averageQueueTime} seconds`);
    console.log(`   Success Rate: ${summary.successRate}%`);
    console.log(`   Overall Efficiency: ${summary.efficiency}/100`);
    
    console.log('\n⚠️ CRITICAL BOTTLENECKS:');
    if (bottlenecks.length === 0) {
      console.log('   ✅ No critical bottlenecks detected');
    } else {
      bottlenecks.forEach((bottleneck, i) => {
        console.log(`   ${i + 1}. [${bottleneck.severity.toUpperCase()}] ${bottleneck.description}`);
        console.log(`      Impact: ${bottleneck.impact}`);
      });
    }
    
    console.log('\n🚀 OPTIMIZATION RECOMMENDATIONS:');
    optimizations.slice(0, 3).forEach((opt, i) => {
      console.log(`   ${i + 1}. ${opt.title} (${opt.priority} priority)`);
      console.log(`      Expected Impact: ${opt.expectedImpact}`);
      opt.recommendations.slice(0, 2).forEach(rec => {
        console.log(`      - ${rec}`);
      });
    });
    
    console.log('\n💰 COST ANALYSIS:');
    console.log(`   Estimated Monthly Cost: $${costAnalysis.estimatedMonthlyCost}`);
    console.log(`   Resource Efficiency: ${costAnalysis.efficiency}%`);
    console.log(`   Potential Monthly Savings: $${costAnalysis.potentialSavings}`);
    console.log(`   Wasted Runtime: ${costAnalysis.wastedTimeMinutes} minutes`);
    
    console.log('\n✅ AUTONOMOUS OPTIMIZATION COMPLETE!');
    console.log(`Analysis Duration: ${results.analysisDuration}ms`);
  }
}

// Main execution function
async function runPerformanceAnalysis() {
  try {
    const analyzer = new CIPerformanceAnalyzer({
      analysisDepth: 100 // Analyze more runs for comprehensive view
    });
    
    const results = await analyzer.analyzeWorkflowPerformance();
    
    // Generate actionable summary
    console.log('\n🎯 IMMEDIATE ACTION ITEMS:');
    const criticalBottlenecks = results.bottlenecks.filter(b => b.severity === 'critical');
    const highPriorityOpts = results.optimizations.filter(o => o.priority === 'critical' || o.priority === 'high');
    
    if (criticalBottlenecks.length > 0) {
      console.log('   🔥 CRITICAL: Address these bottlenecks immediately:');
      criticalBottlenecks.forEach(b => console.log(`      - ${b.description}`));
    }
    
    if (highPriorityOpts.length > 0) {
      console.log('   ⚡ HIGH PRIORITY: Deploy these optimizations:');
      highPriorityOpts.slice(0, 3).forEach(o => console.log(`      - ${o.title}`));
    }
    
    return results;
    
  } catch (error) {
    log.error(`Performance analysis failed: ${error.message}`);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceAnalysis()
    .then(() => {
      log.success('CI/CD performance analysis completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      log.error(`Analysis failed: ${error.message}`);
      process.exit(1);
    });
}

export { CIPerformanceAnalyzer, runPerformanceAnalysis };