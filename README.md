# pi-response-timer

A small [Pi](https://pi.dev) extension that shows elapsed seconds while Pi works and the completion time above the input editor.

```text
Working... 23s
```

When the run finishes, the working indicator disappears and the editor widget shows:

```text
14:32:41 · 36s
```

Only the latest result is shown. It is cleared when the next agent run starts.

## Install

Requires Node.js 22.19.0 or newer. Tested with Pi 1.3.0; older versions are not verified.

```sh
pi install git:github.com/ACaiA-77/pi-response-timer@v0.1.0
```

Run `/reload` in an existing Pi session, or restart Pi. There are no commands or settings to configure. This release is distributed through GitHub, not npm.

If you already copied a `response-timer` extension into your personal extensions directory, disable that copy before enabling this package. Do not load both.

To uninstall:

```sh
pi remove git:github.com/ACaiA-77/pi-response-timer@v0.1.0
```

## Timing and limits

- Starts at Pi's input event and stops when the foreground agent run settles, including model generation, tools, retries, and automatic continuations. Work started without an input event is timed from `before_agent_start`.
- Steering and queued work that stay in the same run share the original timer. This is not a separate timer for each model call or each queued message.
- Independent background agents are not awaited by this timer.
- Displays local time in 24-hour `HH:mm:ss` format and elapsed whole seconds, rounded down. Durations use a monotonic clock, so changing the system clock does not change elapsed time.
- Cancellation also stops the timer and shows the same timestamp format. The widget does not distinguish success, cancellation, or failure.
- Terminal UI only. RPC, JSON, and print modes do not create timers or widgets.
- Reloading, switching sessions, or restarting clears the displayed result; it is not stored in chat history or sent to the model.
- Other extensions that replace the working message may overwrite this extension's text, or vice versa.

The extension makes no network requests, reads or writes no files, and collects no data. Pi provides its runtime API; the package has no additional runtime dependencies.

## Development

```sh
npm ci
npm run check
npm pack --dry-run
```

`check` runs TypeScript checking and six tests through Pi's real extension loader. Tests use mocked clocks and UI calls; they do not replace manual terminal visual checks. The development dependency pins Pi 1.3.0. CI runs on Windows and Ubuntu with Node.js 22 and 24.

MIT licensed. See [LICENSE](LICENSE).

## 中文说明

这个 Pi 扩展在运行时显示 `Working... 23s`，完成后在输入框上方显示 `14:32:41 · 36s`。不显示“结束”“耗时”等标签，只保留最近一轮的记录，下一轮开始时清除。

### 安装与卸载

需要 Node.js 22.19.0 或更新版本，已针对 Pi 1.3.0 测试，旧版尚未验证。当前通过 GitHub 分发，尚未发布到 npm。

```sh
pi install git:github.com/ACaiA-77/pi-response-timer@v0.1.0
```

在已有 Pi 会话中执行 `/reload`，或重启 Pi，即可启用，无需额外配置。如果之前手动安装过 `response-timer` 扩展，请先停用旧副本，避免重复加载。

卸载命令：

```sh
pi remove git:github.com/ACaiA-77/pi-response-timer@v0.1.0
```

### 计时范围

从 Pi 收到输入事件开始，到前台这一轮处理全部结束为止，包含模型生成、工具调用、重试和自动续接。没有输入事件的任务从 `before_agent_start` 开始计时。同一轮中的追加指令和队列消息共用计时，不会为每次模型调用单独计时，也不会等待独立的后台 Agent。

结束时间采用本地时区的 24 小时制，耗时向下取整到秒，并使用不受系统时间调整影响的单调时钟。取消后同样显示时间和耗时，不额外区分成功、取消或失败。

仅适用于终端界面。重新加载、切换会话或重启后，上一轮记录会清除；记录不会写入聊天历史，也不会发送给模型。同时修改 `Working` 提示的其他扩展可能与本扩展互相覆盖。

扩展不联网、不读写文件、不收集数据，也没有额外的运行时依赖。

### 开发

```sh
npm ci
npm run check
npm pack --dry-run
```

检查包含 TypeScript 类型检查及六项通过 Pi 真实扩展加载器运行的测试。测试模拟了时钟和 UI 调用，不能代替终端视觉检查。开发依赖固定为 Pi 1.3.0，CI 覆盖 Windows、Ubuntu 及 Node.js 22、24。

采用 [MIT 许可证](LICENSE)。
