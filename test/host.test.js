const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('official requests provide daily totals and quotas without reading rollouts', async () => {
  const module = { exports: {} }, calls = [], messages = [], intervals = new Map();
  let handler, cleanup, fail = false;
  const source = {
    registerProvider(name, value) { handler = value; return { dispose() {} }; },
    sendRequest(provider, id, method, params) {
      calls.push(method);
      queueMicrotask(() => handler.onResult(fail ? { id, error: { message: 'official unavailable' } } : { id, result: method === 'account/read' ? { account: { type: 'chatgpt', email: 'user@example.com' } } : method === 'account/usage/read' ? { dailyUsageBuckets: [{ startDate: '2026-11-14', tokens: 12345 }] } : { rateLimits: { limitId: 'codex', primary: { usedPercent: 25 } } } }));
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../embedded/host.cjs'), 'utf8'), {
    module, console, Intl, Date,
    require(name) { assert.equal(name, 'vscode', 'host has no local file reader'); return { workspace: { getConfiguration: () => ({ get: () => 'Asia/Shanghai' }) } }; },
    setTimeout, clearTimeout,
    setInterval(fn) { intervals.set(1, fn); return 1; }, clearInterval(id) { intervals.delete(id); }
  });
  module.exports.attach({ async postMessage(message) { messages.push(message); return true; } }, fn => { cleanup = fn; });
  module.exports.nativeUsage('thread/tokenUsage/updated', { threadId: 'current', tokenUsage: { total: { totalTokens: 987 } } }, source);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['account/usage/read', 'account/rateLimits/read', 'account/read']);
  assert.equal(messages.find(item => item.type === 'local-codex-account').label, 'user@example.com');
  assert.equal(messages.find(item => item.type === 'local-codex-native-usage').totalTokens, 987);
  assert.equal(messages.find(item => item.type === 'local-codex-quota').windows[0].remaining, 75);
  assert.equal(messages.find(item => item.type === 'local-codex-usage-calendar').data.days[0].total_tokens, 12345);
  fail = true;
  await intervals.get(1)();
  assert.equal(messages.at(-1).error, 'official unavailable');
  cleanup(); assert.equal(intervals.size, 0);
});
