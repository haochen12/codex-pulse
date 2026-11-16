const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const editors = { vscode: '.vscode', insiders: '.vscode-insiders', server: '.vscode-server', 'server-insiders': '.vscode-server-insiders' };
function extensionsDirectory(editor = 'vscode', home = os.homedir()) {
  if (!editors[editor]) throw new Error(`未知编辑器：${editor}`);
  return path.join(home, editors[editor], 'extensions');
}
async function discover(directory = extensionsDirectory()) {
  directory = path.resolve(directory);
  let registered;
  try { registered = JSON.parse(await fs.readFile(path.join(directory, 'extensions.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const active = (registered || []).filter(item => item.identifier?.id?.toLowerCase() === 'openai.chatgpt');
  if (active.length === 1 && active[0].relativeLocation) {
    const location = active[0].relativeLocation;
    if (path.basename(location) !== location || /[\\/]/.test(location) || !location.startsWith('openai.chatgpt-')) throw new Error('扩展注册路径无效，请用 --target 指定。');
    const target = path.join(directory, location);
    await fs.access(path.join(target, 'package.json'));
    return target;
  }
  const names = (await fs.readdir(directory, { withFileTypes: true })).filter(item => item.isDirectory() && item.name.startsWith('openai.chatgpt-'));
  if (names.length !== 1) throw new Error(`无法唯一确定 Codex 版本（${names.length} 个），请用 --target 指定扩展目录。`);
  return path.join(directory, names[0].name);
}
module.exports = { discover, extensionsDirectory };
