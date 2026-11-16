<h1 align="center">Codex Pulse</h1>

**在 Codex 聊天输入框上方，查看用量、额度与使用足迹。**

[![Tests](https://github.com/haochen12/codex-pulse/actions/workflows/test.yml/badge.svg)](https://github.com/haochen12/codex-pulse/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-%E2%89%A522-339933.svg)](package.json)

Codex Pulse 是面向 Codex VS Code 扩展的本机补丁，在聊天输入框上方添加用量卡片。

> 非 OpenAI 官方产品，也不是独立 VSIX 扩展。用量数据来自官方 Codex 接口，界面嵌入依赖扩展内部结构。补丁不会关闭 Codex 自动更新，升级后可能需要重新应用或适配。

## 功能

- 会话 token 用量与登录账号。
- 周剩余额度、进度条与重置时间。
- 每日用量历史热力图。
- 跟随 VS Code 主题的紧凑卡片。

## 预览

![Codex Pulse 用量卡片](docs/preview.png)

*预览使用模拟数据。*

## 安装与使用

### 环境要求

- Node.js **22+** 和 Git。
- 已安装并登录的 Codex VS Code 扩展。
- 对目标扩展目录有写入权限。

### 快速开始

应用补丁无需运行 `npm install`。

```sh
git clone https://github.com/haochen12/codex-pulse.git
cd codex-pulse
node scripts/patch-codex.cjs status
node scripts/patch-codex.cjs apply
```

确认 `status` 显示“未安装补丁；结构匹配”后再应用。完成后，在 VS Code 命令面板运行 **Developer: Reload Window / 开发人员：重新加载窗口**。

Windows、macOS 和 Linux 使用相同命令；目前已实机验证 Windows / Codex **26.1111.21308**。自定义目录及 Insiders 参数可通过 `node scripts/patch-codex.cjs --help` 查看。远程环境请在 Codex 实际运行的扩展宿主中执行。

### 卸载补丁

在源码目录运行以下命令，然后重新加载窗口：

```sh
node scripts/patch-codex.cjs restore
```

## 更新

### 使用 Skill

将仓库中的 [`skills/codex-pulse-update`](skills/codex-pulse-update/SKILL.md) 文件夹复制到 `~/.codex/skills/`；设置了 `CODEX_HOME` 时，复制到其 `skills/` 目录。重新加载技能后，在 Codex 对话中输入：

```text
$codex-pulse-update 更新补丁
```

技能会检查当前版本、更新源码，并重新应用兼容的补丁。仅检查时输入 `$codex-pulse-update 检查补丁状态`。技能仅在调用时执行，不会在后台自动维护。

### 手动更新

**更新 Codex Pulse 源码**：如果当前版本已打补丁，先用旧源码恢复，再拉取更新：

```sh
node scripts/patch-codex.cjs restore
git pull --ff-only
node scripts/patch-codex.cjs status
node scripts/patch-codex.cjs apply
```

当前版本未安装补丁时，跳过 `restore`。

仅在 `status` 显示未安装且结构匹配时执行 `apply`；成功后重新加载 VS Code 窗口。

**Codex 升级后卡片消失**：在源码目录运行 `status`，显示“未安装补丁；结构匹配”时再运行 `apply`，然后重新加载窗口。显示已安装且校验通过时，无需重复应用。

遇到结构不匹配或文件校验失败，请保留备份并通过 [Issues](https://github.com/haochen12/codex-pulse/issues) 提供版本和错误信息，等待适配。不要将旧版本备份恢复到新版本目录。

## 反馈与贡献

欢迎提交 [Issue](https://github.com/haochen12/codex-pulse/issues) 或 Pull Request。报告问题时请提供操作系统、VS Code 与 Codex 版本、复现步骤及错误信息，并移除账户等个人信息。

提交代码前运行 `npm test`。修改界面时，先执行 `npm ci` 和 `npx playwright install chromium`，再运行 `npm run test:ui`。

## 许可证

本项目采用 [MIT License](LICENSE)。
