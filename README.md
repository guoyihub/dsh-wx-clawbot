# dsh-wx-clawbot

<p align="center">
  <strong>DeepSeek Harness 微信 ClawBot / iLink Host 插件</strong><br>
  手机微信远程驱动电脑上的 DSH Agent —— 配对、任务、推送，全程对话完成
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/node-%3E%3D22.19-brightgreen" alt="Node >= 22.19"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DSH-Host_Bundle-4D6BFE" alt="DSH Host Bundle"></a>
  <a href="https://github.com/guoyihub/dsh-wx-clawbot/releases/tag/v1.0.0"><img src="https://img.shields.io/badge/release-v1.0.0-22C55E" alt="v1.0.0"></a>
  <a href="https://linux.do"><img src="https://img.shields.io/badge/Linux.do-社区认可-F97316?style=flat&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0id2hpdGUiPjx0ZXh0IHg9IjEiIHk9IjEzIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+TDwvdGV4dD48L3N2Zz4=" alt="Linux.do Community"></a>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#文档">文档</a> ·
  <a href="#核心能力">核心能力</a> ·
  <a href="#社区">社区</a> ·
  <a href="docs/README.en.md">English</a>
</p>

---

## 概述

**dsh-wx-clawbot** 是运行于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Host 侧的 Cordis Bundle 插件。安装到 DSH Profile 后，通过腾讯官方 **Weixin ClawBot / iLink** 通道，让授权用户从手机微信向电脑上的 DSH Agent 下发任务、管理会话、审批敏感操作，并接收主动推送。

```text
  手机微信
      │
      ▼
  腾讯 iLink / ClawBot
      │
      ▼
  dsh-wx-clawbot（本插件，Cordis ID: wx-clawbot）
      │
      ▼
  DSH Agent ──► 本机工具 / 工作区 / 持久 Session
```

**一条命令安装：**

```powershell
dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot
```

> **免责声明**  
> 本项目为社区独立集成，**不是**腾讯、微信、DeepSeek 或 DeepSeek Harness 官方产品。  
> 使用腾讯 iLink 接口须遵守腾讯相关服务条款。

---

## 核心能力

| 能力 | 说明 |
|------|------|
| **对话式配对** | Host 中说「帮我配置微信」，Agent 调用 `wx_configure` 自动完成 status → start_pairing → pair_step 全流程 |
| **自然语言任务** | 微信内直接发送需求，Agent 在工作区执行并分段回传结果 |
| **主动推送** | `wx_send` 向已授权用户推送任务通知、绑定确认等（需用户先发过至少一条消息以建立上下文） |
| **会话隔离** | 每个授权用户独立 Session 索引（最多 50 条），支持 `/sessions`、`/new`、`/use`、`/archive` |
| **实时控制** | `/cancel`、`/steer` 绕过普通队列，立即影响运行中任务 |
| **手机审批** | `workspace-write` 越界操作推送一次性审批码，5 分钟有效，超时 fail-closed |
| **Web 协同** | 与 DSH Web / 桌面共用同一持久 Session，互不抢占 Agent 所有权 |

---

## 快速开始

### 环境要求

| 项 | 要求 |
|----|------|
| Node.js | `>= 22.19` |
| DSH Host | `0.1.0-rc.8` 或更高（推荐 `0.1.1-rc.x`） |
| LLM 凭据 | `$DSH_HOME/.credentials.yaml` 中配置 `DEEPSEEK_API_KEY` |
| 网络 | Host 可访问腾讯 iLink |

### 安装并启动

**方式 A · 全局 `dsh` CLI**

```powershell
dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot
dsh web
```

**方式 B · `pnpm dsh`（[deepseek-harness-mobile](https://github.com/deepseek-ai/deepseek-harness) 源码）**

```powershell
cd path\to\deepseek-harness-mobile
pnpm dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot
pnpm dsh
```

打开 `http://127.0.0.1:3080`（或手机访问 `:8030` Mobile PWA），在对话中说：

```text
帮我配置微信网关接入
```

Agent 将引导你完成配对。完整四步流程（启动配对 → 微信内扫码授权 → 配对确认 → 推送测试）见 **[微信网关接入与使用指南](docs/GUIDE.zh.md)**。

### 验证

```text
# 微信内发送
/status

# 或在 Host 对话中说
帮我查看微信通道状态
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [**微信网关接入与使用指南**](docs/GUIDE.zh.md) | 对话式配对四步流程、主动推送、故障排查 |
| [架构说明](docs/ARCHITECTURE.zh.md) | 组件边界、Session 模型、DSH 兼容性 |
| [命令参考](docs/COMMANDS.zh.md) | 微信内 `/status`、`/sessions`、`/approve` 等完整手册 |
| [安全策略](SECURITY.zh.md) | 凭据、授权模型与漏洞报告 |
| [English overview](docs/README.en.md) | English product summary |
| [CHANGELOG](CHANGELOG.md) | 版本变更记录 |

---

## 社区

<table>
  <tr>
    <td width="120"><strong>Linux.do 社区</strong></td>
    <td>本项目获 <a href="https://linux.do">Linux.do</a> 社区认可与支持。Linux.do 是面向开发者与 AI 爱好者的中文技术社区，为本项目的传播、试用与反馈提供了重要助力。</td>
  </tr>
</table>

欢迎在 [GitHub Issues](https://github.com/guoyihub/dsh-wx-clawbot/issues) 提交 Bug 与功能建议，或在 Linux.do 相关话题中交流使用经验。

---

## 安装方式

<details>
<summary><strong>从 GitHub 直装（推荐）</strong></summary>

```powershell
# 全局 dsh
dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot

# pnpm dsh
pnpm dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot
```

桌面版请将 `web` 替换为实际 Profile 名。

</details>

<details>
<summary><strong>固定 Release 版本（生产推荐）</strong></summary>

在 [Releases](https://github.com/guoyihub/dsh-wx-clawbot/releases) 下载 `.tgz`：

```powershell
dsh plugin --profile web add --force .\dsh-wx-clawbot-1.0.0.tgz
```

</details>

<details>
<summary><strong>从源码 checkout（开发）</strong></summary>

```powershell
git clone https://github.com/guoyihub/dsh-wx-clawbot.git
cd dsh-wx-clawbot
dsh plugin --profile web add --force .
```

</details>

安装完成后插件出现在 Profile 的 `dsh.profile.bundles` 中，Cordis 插件 ID 为 **`wx-clawbot`**。

---

## Agent 工具

本插件向 DSH Tool Registry 注册两个工具，无需修改 DSH 核心。

### `wx_configure`

对话式安装与运维入口。

| `action` | 作用 |
|----------|------|
| `status` | 查看配对、凭据、工作区、授权用户 |
| `start_pairing` | 开始扫码配对，返回腾讯 `pairingUrl` |
| `pair_step` | 推进配对（可带 `verify_code`） |
| `cancel_pairing` | 取消进行中的配对 |
| `disconnect` | 解除本机配对与凭据 |

### `wx_send`

向已授权微信用户主动发送文本（任务通知、结果推送等）。

> 目标用户须先向 ClawBot 发送至少一条消息，系统才会缓存 `context_token`，否则推送会失败并返回明确指引。

---

## CLI（可选）

适合脚本或无 UI 环境：

```powershell
wx-clawbot setup --agent-cwd D:\your-workspace
wx-clawbot status
wx-clawbot disconnect
```

---

## 配置

默认配置来自 `cordis.patch.yml`，可在 Profile 层 `cordis.patch.yml` 覆盖：

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `credentialRef` | `WX_CLAWBOT_BOT_TOKEN` | DSH 凭据引用名 |
| `agentCwd` | 安装时指定 | 微信任务的工作区根目录 |
| `agentPreset` | `standard` | 新会话 Preset |
| `permissionPreset` | `workspace-write` | 权限预设 |
| QR 配对端口 | `3081` | 与 Mobile PWA `:8030` 错开 |

状态目录：`$DSH_HOME/wx-clawbot/`

---

## 与 deepseek-harness-mobile 的关系

[deepseek-harness-mobile](https://github.com/deepseek-ai/deepseek-harness) 在 `:8030` 提供 Mobile PWA，在 `:3080` 提供 Host API。  
**微信通道与 Mobile 配对是两条独立链路**——微信消息不会出现在 Mobile 聊天线程中。

| 服务 | 端口 |
|------|------|
| DSH Host | 3080 |
| Mobile PWA | 8030 |
| 微信 QR 配对（CLI setup） | 3081 |

---

## 开发

```powershell
git clone https://github.com/guoyihub/dsh-wx-clawbot.git
cd dsh-wx-clawbot
npm ci --legacy-peer-deps
npm run check
npm test
```

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 安全

请勿在 Issue、日志或对话中粘贴 Bot Token、配对 QR 或用户 ID。  
详见 [SECURITY.zh.md](SECURITY.zh.md)。

---

## 致谢与 lineage

| 项目 | 关系 |
|------|------|
| [zp-home/dsh-weixin-clawbot](https://github.com/zp-home/dsh-weixin-clawbot) | 原始 Weixin ClawBot DSH 适配实现 |
| [deepseek-harness / deepseek-harness-mobile](https://github.com/deepseek-ai/deepseek-harness) | 运行时 Host 与 Mobile 集成验证目标 |
| [Linux.do](https://linux.do) | 社区认可与支持 |
| 腾讯 Weixin ClawBot / iLink | 官方消息通道 |

当前仓库在原始项目基础上演进为 `wx-clawbot` 插件 ID，并新增 `wx_configure` 对话式配置与 `wx_send` 主动推送能力。

---

## License

[MIT](LICENSE) — Copyright (c) 2026 zp-home and contributors.  
See [NOTICE.md](NOTICE.md) for lineage and third-party notices.
