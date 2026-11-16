# Codex Pulse

在 Codex 聊天输入框上方，查看会话 token、账号、周剩余额度与重置时间，并用历史热力图展示使用足迹。卡片跟随 VS Code 主题。

![Codex Pulse 用量卡片](docs/preview.png)

*预览使用模拟数据。*

这是一个面向 Codex VS Code 扩展的本机补丁，非 OpenAI 官方产品。用量数据来自官方 Codex 接口，界面嵌入依赖扩展内部结构。**补丁不会关闭 Codex 自动更新。**

## 怎么使用

准备 Node.js **22+**、Git，以及已安装并登录的 Codex VS Code 扩展。无需运行 `npm install`。

```sh
git clone https://github.com/haochen12/codex-pulse.git
cd codex-pulse
node scripts/patch-codex.cjs status
node scripts/patch-codex.cjs apply
```

确认 `status` 显示“未安装补丁；结构匹配”后再应用。完成后，在 VS Code 命令面板运行 **Developer: Reload Window / 开发人员：重新加载窗口**。

Windows、macOS 和 Linux 使用相同命令；目前已实机验证 Windows / Codex **26.1111.21308**。自定义目录及 Insiders 参数可通过 `node scripts/patch-codex.cjs --help` 查看。远程环境请在 Codex 实际运行的扩展宿主中执行。

需要移除补丁时，在源码目录运行以下命令，然后重新加载窗口：

```sh
node scripts/patch-codex.cjs restore
```

## 如何更新

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

**Codex 升级后卡片消失**：在源码目录运行 `status`，显示“未安装补丁；结构匹配”时再运行 `apply`，然后重新加载窗口。显示已安装且校验通过时，无需重复应用。

遇到结构不匹配或文件校验失败，请保留备份并通过 [Issues](https://github.com/haochen12/codex-pulse/issues) 提供版本和错误信息，等待适配。不要将旧版本备份恢复到新版本目录。

[MIT License](LICENSE)
