const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { apply, restore, hook } = require('../scripts/patch-codex.cjs');
test('patch backs up originals, rejects double apply, verifies hashes and restores exactly', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-patch-test-'));
  try {
    await fs.mkdir(path.join(root, 'out'));
    await fs.mkdir(path.join(root, 'webview'));
    const original = `class UI{async initializeWebview(e,r,n,o){let i='x';${hook}let s=1;}notify(n,o){for(let a of this.internalNotificationHandlers)try{a({method:n,params:o})}catch(e){}}}`;
    const html = '<html><head></head><body></body></html>';
    await fs.writeFile(path.join(root, 'out/extension.js'), original);
    await fs.writeFile(path.join(root, 'webview/index.html'), html);
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ publisher: 'openai', name: 'chatgpt', version: 'fixture' }));
    await apply(root);
    const patched = await fs.readFile(path.join(root, 'out/extension.js'), 'utf8');
    assert.match(patched, /codex-usage-host/);
    assert.match(await fs.readFile(path.join(root, 'webview/index.html'), 'utf8'), /codex-usage-calendar.js/);
    await assert.rejects(apply(root), /已有补丁备份/);
    await fs.appendFile(path.join(root, 'out/extension.js'), '//external change');
    await assert.rejects(restore(root), /其他更新修改/);
    await fs.writeFile(path.join(root, 'out/extension.js'), patched);
    await restore(root);
    assert.equal(await fs.readFile(path.join(root, 'out/extension.js'), 'utf8'), original);
    assert.equal(await fs.readFile(path.join(root, 'webview/index.html'), 'utf8'), html);
    await assert.rejects(fs.access(path.join(root, 'webview/codex-usage-calendar.js')));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
