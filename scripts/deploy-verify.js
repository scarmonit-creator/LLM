#!/usr/bin/env node

/**
 * Autonomous AI Bridge Deployment Verification
 * Tests hardened v1.1.0 endpoints and reports status
 */

import https from 'https';
import http from 'http';

const EXPECTED_VERSION = '1.1.0';
const TIMEOUT = 10000;

// ANSI colors
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, prefix, message) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

function info(msg) { log(colors.blue, 'INFO', msg); }
function success(msg) { log(colors.green, 'SUCCESS', msg); }
function warning(msg) { log(colors.yellow, 'WARNING', msg); }
function error(msg) { log(colors.red, 'ERROR', msg); }

async function testEndpoint(url, expectedVersion = EXPECTED_VERSION) {
  return new Promise((resolve) => {
    const client = url.startsWith('https:') ? https : http;
    const startTime = Date.now();
    
    const req = client.get(url, { timeout: TIMEOUT }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        try {
          const parsed = JSON.parse(data);
          const hasVersion = data.includes(expectedVersion);
          
          if (res.statusCode === 200 && hasVersion) {
            success(`✅ ${url} - ${responseTime}ms`);
            
            // Extract key metrics
            if (parsed.connectedClients !== undefined) {
              info(`   Connected clients: ${parsed.connectedClients}`);
            }
            if (parsed.uptime !== undefined) {
              info(`   Uptime: ${parsed.uptime}s`);
            }
            if (parsed.performance?.messagesProcessed !== undefined) {
              info(`   Messages processed: ${parsed.performance.messagesProcessed}`);
            }
            
            resolve({ success: true, responseTime, data: parsed });
          } else {
            warning(`⚠️  ${url} - Status ${res.statusCode}, version check: ${hasVersion}`);
            resolve({ success: false, responseTime, error: `Status ${res.statusCode}` });
          }
        } catch (e) {
          warning(`⚠️  ${url} - Invalid JSON response`);
          resolve({ success: false, responseTime, error: 'Invalid JSON' });
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      error(`❌ ${url} - Timeout after ${TIMEOUT}ms`);
      resolve({ success: false, error: 'Timeout' });
    });
    
    req.on('error', (err) => {
      error(`❌ ${url} - ${err.message}`);
      resolve({ success: false, error: err.message });
    });
  });
}

async function verifyDeployment(baseUrl) {
  console.log(`\n🔍 Verifying deployment: ${baseUrl}`);
  console.log('='.repeat(50));
  
  const endpoints = [
    { path: '/health', name: 'Health Check' },
    { path: '/api/status', name: 'Status API' }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint.path}`;
    info(`Testing ${endpoint.name}: ${url}`);
    
    const result = await testEndpoint(url);
    results.push({ ...result, endpoint: endpoint.name, url });
    
    if (result.success && result.responseTime) {
      if (result.responseTime < 1000) {
        success(`   Performance: EXCELLENT (${result.responseTime}ms)`);
      } else if (result.responseTime < 2000) {
        info(`   Performance: GOOD (${result.responseTime}ms)`);
      } else {
        warning(`   Performance: SLOW (${result.responseTime}ms)`);
      }
    }
  }
  
  return results;
}

async function main() {
  console.log('🚀 AI BRIDGE DEPLOYMENT VERIFICATION');
  console.log('====================================\n');
  
  // Default deployment URLs
  const deploymentUrls = [
    'https://llm-ai-bridge.onrender.com',
    'https://llm-ai-bridge.fly.dev',
    'https://llm-ai-bridge.up.railway.app'
  ];
  
  // Use custom URL if provided
  const customUrl = process.argv[2];
  const urlsToTest = customUrl ? [customUrl] : deploymentUrls;
  
  if (customUrl) {
    info(`Testing custom URL: ${customUrl}`);
  }
  
  let totalTests = 0;
  let successfulTests = 0;
  const deploymentResults = [];
  
  for (const baseUrl of urlsToTest) {
    const results = await verifyDeployment(baseUrl);
    deploymentResults.push({ baseUrl, results });
    
    const successful = results.filter(r => r.success).length;
    totalTests += results.length;
    successfulTests += successful;
  }
  
  // Summary
  console.log('\n📊 VERIFICATION SUMMARY');
  console.log('======================');
  console.log(`   Tests passed: ${successfulTests}/${totalTests}`);
  console.log(`   Success rate: ${Math.round((successfulTests / totalTests) * 100)}%`);
  
  if (successfulTests === totalTests) {
    success('\n🎉 ALL DEPLOYMENTS VERIFIED SUCCESSFULLY!');
    console.log('\nNext steps:');
    console.log('   1. Load browser extension from extensions/selected-text-analyzer/');
    console.log('   2. Test text analysis functionality');
    console.log('   3. Monitor performance via /api/status');
    process.exit(0);
  } else if (successfulTests > 0) {
    warning('\n⚠️  PARTIAL SUCCESS - Some deployments working');
    console.log('\nAction items:');
    console.log('   1. Check failed deployments for configuration issues');
    console.log('   2. Verify environment variables are set correctly');
    process.exit(1);
  } else {
    error('\n❌ NO DEPLOYMENTS VERIFIED');
    console.log('\nTroubleshooting:');
    console.log('   1. Ensure deployments have completed successfully');
    console.log('   2. Check deployment logs and configurations');
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testEndpoint, verifyDeployment };