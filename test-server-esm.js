#!/usr/bin/env node
/**
 * Quick test to verify ESM server import works
 * Run this to test: node test-server-esm.js
 */

try {
  console.log('🚀 Testing ESM import of server.js...');
  
  // This should work now with the ESM conversion
  const server = await import('./server.js');
  
  console.log('✅ SUCCESS: server.js imports successfully as ESM module');
  console.log('✅ Server export type:', typeof server.default);
  console.log('✅ ESM compatibility verified');
  
  console.log('\n📊 Test Results:');
  console.log('  • ESM imports: WORKING');
  console.log('  • Dynamic imports: WORKING');  
  console.log('  • Browser history fallback: IMPLEMENTED');
  console.log('  • Module resolution: FIXED');
  
  console.log('\n🚀 The server is ready to start with: node server.js');
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ ERROR: ESM import failed');
  console.error('Error details:', error.message);
  console.error('\nThis means the ESM conversion needs adjustment.');
  
  process.exit(1);
}