const fs = require('node:fs/promises');
const path = require('node:path');
const { discover, extensionsDirectory } = require('./discovery.cjs');
const crypto = require('node:crypto');
const project = path.resolve(__dirname, '..');
const marker = '/* local-codex-usage-calendar */';
const hook = 'e.options={enableScripts:!0,enableCommandUris:!1,localResourceRoots:[i]};';
const nativeHook = 'for(let a of this.internalNotificationHandlers)try{';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
async function apply(target) {
  target = path.resolve(target);
  const manifestPath = path.join(target, 'codex-usage-patch-backup', 'manifest.json');
  try {
    await fs.access(manifestPath);
    throw new Error('此版本已有补丁备份，请先 restore 再重新 apply。');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const entry = await fs.readFile(path.join(target, 'out/extension.js'), 'utf8');
  const html = await fs.readFile(path.join(target, 'webview/index.html'), 'utf8');
  if (entry.includes(marker) || html.includes(marker)) throw new Error('检测到现有补丁标记，拒绝重复写入。');
  if (entry.split(hook).length !== 2 || !entry.includes('async initializeWebview(e,r,n,o)')) throw new Error('Codex 内部结构与已验证版本不同，未修改任何文件。');
  if (html.split('</head>').length !== 2) throw new Error('Webview 模板结构不匹配。');
  if (entry.split(nativeHook).length !== 2) throw new Error('原生用量事件结构不匹配，未修改任何文件。');
  const packageInfo = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'));
  if (packageInfo.publisher !== 'openai' || packageInfo.name !== 'chatgpt') throw new Error('指定目录不是官方 Codex 扩展。');
  const changes = new Map([
    ['out/extension.js', Buffer.from(entry.replace(hook, `${hook}${marker}try{require("./codex-usage-host.cjs").attach(e,n)}catch(cucError){console.error("Codex usage calendar:",cucError)}`).replace(nativeHook, `try{require("./codex-usage-host.cjs").nativeUsage(n,o,this)}catch(cucError){}${nativeHook}`))],
    ['webview/index.html', Buffer.from(html.replace('</head>', `${marker.replace('/* ', '<!-- ').replace(' */', ' -->')}\n<link rel="stylesheet" href="./codex-usage-calendar.css">\n<script type="module" src="./codex-usage-calendar.js"></script>\n</head>`))],
    ['out/codex-usage-host.cjs', await fs.readFile(path.join(project, 'embedded/host.cjs'))],
    ['webview/codex-usage-calendar.js', await fs.readFile(path.join(project, 'embedded/calendar.js'))],
    ['webview/codex-usage-calendar.css', await fs.readFile(path.join(project, 'embedded/calendar.css'))]
  ]);
  const backup = path.dirname(manifestPath);
  const manifest = { version: 1, codexVersion: packageInfo.version, createdAt: new Date().toISOString(), files: [] };
  await fs.mkdir(backup, { recursive: true });
  for (const [relative, data] of changes) {
    let original;
    try { original = await fs.readFile(path.join(target, relative)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (original) {
      await fs.mkdir(path.dirname(path.join(backup, relative)), { recursive: true });
      await fs.writeFile(path.join(backup, relative), original);
    }
    manifest.files.push({ relative, originalHash: original ? hash(original) : null, patchedHash: hash(data) });
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  try {
    for (const [relative, data] of changes) await fs.writeFile(path.join(target, relative), data);
  } catch (error) {
    for (const item of manifest.files) {
      const file = path.join(target, item.relative);
      if (item.originalHash) await fs.copyFile(path.join(backup, item.relative), file);
      else await fs.rm(file, { force: true });
    }
    await fs.rm(manifestPath);
    throw error;
  }
  console.log(`已应用到 Codex ${packageInfo.version}：${target}\n备份：${backup}\n未修改自动更新设置或锁定版本。Codex 更新后若补丁失效，请先 status 检查，再 apply。\n请在 VS Code 中运行 Developer: Reload Window（开发人员：重新加载窗口）。`);
}
async function restore(target) {
  target = path.resolve(target);
  const backup = path.join(target, 'codex-usage-patch-backup');
  const manifest = JSON.parse(await fs.readFile(path.join(backup, 'manifest.json'), 'utf8'));
  const allowed = new Set(['out/extension.js', 'webview/index.html', 'out/codex-usage-host.cjs', 'out/codex-usage-reader.cjs', 'webview/codex-usage-calendar.js', 'webview/codex-usage-calendar.css']);
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.some(item => !allowed.has(item.relative))) throw new Error('备份清单格式或文件路径无效，停止恢复。');
  // Check every file before restoring any, so a newer extension is never overwritten.
  for (const item of manifest.files) {
    if (hash(await fs.readFile(path.join(target, item.relative))) !== item.patchedHash) throw new Error(`文件已被其他更新修改，停止恢复：${item.relative}`);
    if (item.originalHash && hash(await fs.readFile(path.join(backup, item.relative))) !== item.originalHash) throw new Error(`备份校验失败：${item.relative}`);
  }
  for (const item of manifest.files) {
    const file = path.join(target, item.relative);
    if (item.originalHash) await fs.copyFile(path.join(backup, item.relative), file);
    else await fs.rm(file);
  }
  await fs.rename(path.join(backup, 'manifest.json'), path.join(backup, `restored-${Date.now()}.json`));
  console.log('已恢复原始 Codex 文件。请重新加载 VS Code 窗口。');
}
async function status(target) {
  target = path.resolve(target);
  const pkg = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'));
  if (pkg.publisher !== 'openai' || pkg.name !== 'chatgpt') throw new Error('指定目录不是官方 Codex 扩展。');
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(target, 'codex-usage-patch-backup/manifest.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (manifest) {
    for (const file of manifest.files) if (hash(await fs.readFile(path.join(target, file.relative))) !== file.patchedHash) throw new Error(`补丁文件被修改：${file.relative}`);
    console.log(`Codex ${pkg.version}：补丁已应用，文件校验通过。\n${target}`);
  } else {
    const entry = await fs.readFile(path.join(target, 'out/extension.js'), 'utf8');
    const compatible = entry.split(hook).length === 2 && entry.split(nativeHook).length === 2 && entry.includes('async initializeWebview(e,r,n,o)');
    console.log(`Codex ${pkg.version}：未安装补丁；结构${compatible ? '匹配' : '不匹配，需要适配'}。\n${target}`);
  }
}
async function main() {
  const args = process.argv.slice(2);
  const help = '用法：node scripts/patch-codex.cjs apply|restore|status [--editor vscode|insiders|server|server-insiders] [--extensions-dir 路径] [--target Codex扩展路径]';
  if (!args.length || args.includes('--help')) { console.log(help); return; }
  const action = args.shift(), options = {};
  if (!['apply', 'restore', 'status'].includes(action)) throw new Error(help);
  while (args.length) {
    const key = args.shift();
    if (!['--target', '--editor', '--extensions-dir'].includes(key) || !args.length || args[0].startsWith('--')) throw new Error(help);
    options[key] = args.shift();
  }
  const target = options['--target'] || await discover(options['--extensions-dir'] || extensionsDirectory(options['--editor']));
  await ({ apply, restore, status }[action])(target);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { apply, restore, status, hook };
