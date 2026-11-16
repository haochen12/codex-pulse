const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { discover, extensionsDirectory } = require('../scripts/discovery.cjs');
test('editor paths are relative to the current home on each platform', () => {
  for (const [editor, folder] of [['vscode', '.vscode'], ['insiders', '.vscode-insiders'], ['server', '.vscode-server'], ['server-insiders', '.vscode-server-insiders']]) {
    assert.equal(extensionsDirectory(editor, '/home/test user'), path.join('/home/test user', folder, 'extensions'));
  }
  assert.throws(() => extensionsDirectory('unknown'));
});
test('registry selects the active version; missing registry supports one version and rejects ambiguity', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'calendar-discovery-'));
  try {
    const first = 'openai.chatgpt-old', second = 'openai.chatgpt-current';
    for (const name of [first, second]) { await fs.mkdir(path.join(root, name)); await fs.writeFile(path.join(root, name, 'package.json'), '{}'); }
    await assert.rejects(discover(root), /无法唯一确定/);
    await fs.writeFile(path.join(root, 'extensions.json'), JSON.stringify([{ identifier: { id: 'openai.chatgpt' }, relativeLocation: second }]));
    assert.equal(await discover(root), path.join(root, second));
    await fs.writeFile(path.join(root, 'extensions.json'), JSON.stringify([{ identifier: { id: 'openai.chatgpt' }, relativeLocation: '../outside' }]));
    await assert.rejects(discover(root), /路径无效/);
    const single = path.join(root, 'single'); await fs.mkdir(single); await fs.mkdir(path.join(single, first));
    assert.equal(await discover(single), path.join(single, first));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
