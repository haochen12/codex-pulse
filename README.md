# Codex Pulse

A lightweight usage dashboard patch for the Codex VS Code extension.

在 Codex 输入框上方，查看用量、额度与使用足迹。

![Codex Pulse preview with simulated data](docs/preview.png)

> 独立开源项目，与 OpenAI 无隶属关系。预览使用模拟数据。

跨平台的本机补丁工具，在 Codex 输入框上方展示固定用量卡片。历史热力格作背景，前景显示会话 token、周剩余额度及重置时间，底部进度条表示周剩余额度。配色跟随 VS Code 主题。

这是 Codex 补丁，不是 VSIX 插件。数据使用官方接口，连接接入与界面嵌入仍依赖 Codex 内部结构，升级可能需要适配。

## 使用

需要 Node.js 22+，以及已安装并登录的 Codex VS Code 扩展。运行补丁无需 npm install，无运行时第三方依赖。

先下载源码，或克隆仓库：

```sh
git clone https://github.com/haochen12/codex-pulse.git
cd codex-pulse
```

在项目目录打开终端，Windows、macOS、Linux 使用相同命令：

```sh
node scripts/patch-codex.cjs status
node scripts/patch-codex.cjs apply
node scripts/patch-codex.cjs restore
```

完成应用或恢复后，在 VS Code 运行「开发人员：重新加载窗口」。不要并发运行补丁命令。

默认读取 ~/.vscode/extensions 注册表，选择启用的 Codex 版本。其他位置：

```sh
node scripts/patch-codex.cjs apply --editor insiders
node scripts/patch-codex.cjs apply --editor server
node scripts/patch-codex.cjs apply --editor server-insiders
node scripts/patch-codex.cjs apply --extensions-dir "/custom/extensions"
node scripts/patch-codex.cjs apply --target "/custom/extensions/openai.chatgpt-VERSION"
```

路径含空格需加引号。便携安装、其他编辑器分支用 --extensions-dir 或 --target。WSL、SSH、容器应在 Codex 实际运行的扩展宿主环境执行；本地、远程安装分别处理。恢复时传入与安装相同的路径选项。多个未注册版本不自动选择最新版本。

## 官方数据

账号标识使用 account/read 返回的登录邮箱（官方未返回昵称）；显示在会话用量下方，长邮箱省略，悬停查看完整邮箱。账号变更时清空旧显示并重新请求。


- account/usage/read：每日历史，每分钟刷新，日期沿用官方返回。
- thread/tokenUsage/updated：当前会话累计用量，随原生事件更新；未收到时显示今日汇总。
- account/rateLimits/read 与 account/rateLimits/updated：剩余额度。周窗口为 10080 分钟，重置时间来自 resetsAt。
- 不读取会话 JSONL，不用日志估算，不读取登录凭据。接口不可用时显示错误或等待；API key 账户或未开放能力的账户可能没有统计。
- 重置时间默认使用系统时区；已配置 codexUsage.timeZone 时沿用。每日桶日期不换算时区。

## 兼容与恢复

已验证 Codex 26.1111.21308。跨平台不代表兼容所有 Codex 版本；内部结构不匹配时拒绝写入。

修改 out/extension.js 与 webview/index.html，新增三个资源文件。原文件及 SHA-256 校验保存在目标扩展的 codex-usage-patch-backup。恢复前检查全部文件，外部修改会阻止恢复，避免覆盖其他更新。旧补丁先 restore 再 apply；升级后先 status 检查。不要删除需要恢复的备份。

## 开发

```sh
npm test
npm ci
npx playwright install chromium
npm run test:ui
npm pack
```

单元测试无依赖。UI 测试使用模拟官方返回，不读取本机记录；CHROME_PATH 可指定浏览器。npm pack 只包含运行工具、资源、说明及许可证。

Windows 已验证文件操作和 Chromium 布局。macOS、Linux 已检查目录逻辑与可移植性，尚未实机验证。

## 贡献

欢迎通过 Issue 报告 Codex 版本兼容问题，请附操作系统、VS Code 和 Codex 版本、错误信息。请勿提交邮箱、登录凭据、真实聊天记录或个人用量。提交代码前运行单元测试；修改界面时运行 UI 测试。

## License

[MIT](LICENSE)
