# 微信网关接入与使用指南

[返回首页](../README.md) · [命令参考](COMMANDS.zh.md) · [架构说明](ARCHITECTURE.zh.md) · [English overview](README.en.md)

本指南面向已在本地运行 **DSH Web Host** 的用户，说明如何通过 Agent 对话完成微信 ClawBot 配对、验证通道，以及使用主动推送能力。

---

## 前置条件

| 项 | 要求 |
|----|------|
| DSH Host | 已启动并可在浏览器访问（默认 `http://127.0.0.1:3080`） |
| LLM 凭据 | `$DSH_HOME/.credentials.yaml` 中已配置 `DEEPSEEK_API_KEY` |
| 插件 | 已通过 `dsh plugin add` 安装本 Bundle（Cordis ID：`wx-clawbot`） |
| 网络 | Host 可访问腾讯 iLink；配对时手机与电脑在同一局域网或经穿透可达 |

---

## 一、对话式配对（推荐）

在 DSH Host 对话中说：**「帮我配置微信网关接入」** 或 **「帮我配置微信」**。  
Agent 将依次调用内置工具 `wx_configure`，自动推进以下四步。

### 步骤 1 · 启动配对

Agent 调用 `wx_configure · status` 检查当前状态。若尚未配对，则调用 `start_pairing` 获取腾讯官方配对链接。

| 字段 | 说明 |
|------|------|
| `pairingUrl` | 腾讯返回的 `qrcode_img_content`，形如 `https://weixin.qq.com/x/...` |
| `pairingPageUrlLocal` | 本机 QR 页面（CLI / 启用本地 HTTP 时出现） |
| `pairingPageUrlMobile` | 手机 LAN 访问 QR 页面（配置了 `mobilePublicBaseUrl` 时出现） |

**你需要做的：**

1. 复制 Agent 给出的 **`pairingUrl`**（腾讯官方链接）。
2. 在 **手机微信内** 打开该链接（不要在外部浏览器打开）。
3. 按微信提示完成扫码或授权确认。

> Host 配对优先使用腾讯 `pairingUrl`，无需依赖 `127.0.0.1` 图片代理。

### 步骤 2 · 扫码授权

在微信 App 内完成腾讯官方授权界面后，回到 Host 对话告诉 Agent：**「我已在微信里完成授权」**。

Agent 将调用 `pair_step` 轮询配对进度。若腾讯要求数字验证码，按提示传入 `verify_code`。

### 步骤 3 · 配对确认

配对成功后，Agent 会展示类似如下信息：

| 项 | 示例 |
|----|------|
| 状态 | 已配对 ✅ |
| 工作区 | 当前 `agentCwd` 绝对路径 |
| 授权用户 | 脱敏后的 OpenID 列表 |

凭据写入 `$DSH_HOME/.credentials.yaml`（引用名默认 `WX_CLAWBOT_BOT_TOKEN`），通道自动激活。

### 步骤 4 · 主动推送测试（可选）

配对完成后，可在 Host 对话中说：**「推送一句 DSH 绑定完成」**。

Agent 调用 `wx_send` 向已授权用户发送确认消息，例如：

```text
✅ DSH 绑定完成，微信网关已成功接入。
```

**重要前提：** 用户须 **先向微信 ClawBot 发送至少一条消息**，系统才会缓存会话上下文（`context_token`）。在此之前调用 `wx_send` 会返回可操作的失败提示，而非静默丢弃。

---

## 二、微信内验证

配对完成后，在手机微信向 ClawBot 发送：

```text
/status
```

正常回复应包含任务状态、当前会话、工作区、Preset、权限与模型等信息。

进阶诊断：

```text
/doctor
```

查看 iLink 轮询、Outbox 与可选 DSH 能力状态（已脱敏）。

---

## 三、典型使用场景

### 远程任务下发

直接发送自然语言，例如：

```text
帮我分析 C 盘空间占用，列出可安全清理的目录
```

Agent 将在绑定的工作区执行任务，结果分段回传到微信。长任务会定时发送进度；可用 `/cancel` 取消、`/steer <修正>` 在下一 step 边界插入修正。

### 会话管理

| 命令 | 作用 |
|------|------|
| `/sessions` | 列出当前用户的未归档会话 |
| `/new [标题]` | 新建会话 |
| `/use <序号或短ID>` | 切换会话 |
| `/archive [序号]` | 归档会话 |

完整命令列表见 [命令参考](COMMANDS.zh.md)。

### Host 主动推送

在 DSH Web / Mobile 对话中，Agent 可使用 `wx_send` 向微信推送任务完成通知、审批提醒等。详见 README [Agent 工具](../README.md#agent-工具) 一节。

---

## 四、CLI 配对（无 UI 环境）

适用于脚本化部署或无法打开 Host 界面的场景：

```powershell
cd D:\your-workspace
wx-clawbot setup --agent-cwd D:\your-workspace
```

终端显示 QR，并在 `:3081` 提供 HTTP 配对页（`/api/wx-clawbot/pairing`）。  
安装或 Profile 变更后须 **重启持久化 DSH Host**。

验证：

```powershell
wx-clawbot status
```

---

## 五、故障排查

| 现象 | 排查方向 |
|------|----------|
| 微信无回复 | 确认持久化 Host 正在运行，且 Bundle 安装在 Host 实际使用的 Profile |
| 配对成功但任务目录错误 | 检查 `agentCwd`，使用绝对路径；变更后新建手机会话 |
| `wx_send` 失败 | 确认目标用户已向 ClawBot 发送过至少一条消息以建立上下文 |
| 回复延迟 | 运行 `/doctor`；Outbox 会在 transient 故障后自动重试，勿清空状态 |
| 凭据丢失 | 运行 `wx-clawbot status`；勿在日志或对话中粘贴 Token / QR |

解除配对：

```powershell
wx-clawbot disconnect
```

或在 Host 对话中说：**「解除微信配对」**（Agent 调用 `wx_configure · disconnect`）。

---

## 六、与 Mobile PWA 的关系

[deepseek-harness-mobile](https://github.com/deepseek-ai/deepseek-harness) 在 `:8030` 提供 Mobile PWA，在 `:3080` 提供 Host API。

**微信通道与 Mobile 配对是两条独立链路**——微信消息不会出现在 Mobile 聊天线程中，但可在同一 DSH Session 上由 Web / 桌面 / 微信分别继续。

推荐端口：

| 服务 | 端口 |
|------|------|
| DSH Host | 3080 |
| Mobile PWA | 8030 |
| 微信 QR 配对（CLI setup） | 3081 |
