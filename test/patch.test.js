const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { apply, restore, hook } = require('../scripts/patch-codex.cjs');
const { discover } = require('../scripts/discovery.cjs');
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

test('Codex upgrade selects the new version without changing update metadata or the old version', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-upgrade-test-'));
  try {
    const makeVersion = async version => {
      const target = path.join(root, `openai.chatgpt-${version}`);
      await fs.mkdir(path.join(target, 'out'), { recursive: true });
      await fs.mkdir(path.join(target, 'webview'));
      await fs.writeFile(path.join(target, 'out/extension.js'), `async initializeWebview(e,r,n,o){${hook}}for(let a of this.internalNotificationHandlers)try{}`);
      await fs.writeFile(path.join(target, 'webview/index.html'), '<html><head></head></html>');
      await fs.writeFile(path.join(target, 'package.json'), JSON.stringify({ publisher: 'openai', name: 'chatgpt', version }));
      return target;
    };
    const registryPath = path.join(root, 'extensions.json');
    const register = async target => {
      const data = JSON.stringify([{ identifier: { id: 'openai.chatgpt' }, relativeLocation: path.basename(target), metadata: { pinned: false, source: 'gallery' } }]);
      await fs.writeFile(registryPath, data);
      return data;
    };
    const oldTarget = await makeVersion('1.0.0');
    const oldRegistry = await register(oldTarget);
    await apply(await discover(root));
    assert.equal(await fs.readFile(registryPath, 'utf8'), oldRegistry);
    const oldEntry = await fs.readFile(path.join(oldTarget, 'out/extension.js'), 'utf8');
    const newTarget = await makeVersion('2.0.0');
    const newRegistry = await register(newTarget);
    const packagePath = path.join(newTarget, 'package.json');
    const packageBefore = await fs.readFile(packagePath, 'utf8');
    assert.equal(await discover(root), newTarget);
    await apply(await discover(root));
    await restore(newTarget);
    assert.equal(await fs.readFile(registryPath, 'utf8'), newRegistry);
    assert.equal(await fs.readFile(packagePath, 'utf8'), packageBefore);
    assert.equal(await fs.readFile(path.join(oldTarget, 'out/extension.js'), 'utf8'), oldEntry);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
