import { strict as assert } from 'assert';
import TabSelectionManager from '../src/selection/tab-selection-manager.js';

(async () => {
  const manager = new TabSelectionManager();

  // Test selection analysis
  const res = await manager.handleTextSelection('tab-1', 'This is an amazing result with excellent performance!', { pageType: 'form' });
  assert.equal(res.language === 'en', true);
  assert.equal(typeof res.wordCount, 'number');
  assert.ok(Array.isArray(res.suggestions));

  // Test caching
  const res2 = await manager.handleTextSelection('tab-1', 'This is an amazing result with excellent performance!', { pageType: 'form' });
  assert.deepEqual(res.preview, res2.preview);

  // Test tab optimization stub
  const opt = await manager.optimizeCurrentTab('tab-1', { url: 'https://example.com', title: 'Example', loadTime: 5000, memoryUsage: 200*1024*1024 });
  assert.ok(opt.performance.suggestions.length > 0);

  console.log('selection-manager basic tests: OK');
  process.exit(0);
})().catch((e) => {
  console.error('selection-manager tests failed:', e);
  process.exit(1);
});
