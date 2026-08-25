# dsh-wx-clawbot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.19-brightgreen)](package.json)
[![DSH Plugin](https://img.shields.io/badge/DSH-Host_Bundle-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

**DeepSeek Harness 的微信 ClawBot/iLink Host 插件。** 安装到 DSH Profile 后，可通过 Agent 对话完成配对，从手机微信远程驱动电脑上的 Agent 任务。

```powershell
# 安装插件（web 可换成你的 Profile 名）
dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot
```

| 文档 | 说明 |
|------|------|
| [架构说明](docs/ARCHITECTURE.zh.md) | 组件边界、Session 模型、兼容性 |
| [命令参考](docs/COMMANDS.zh.md) | 微信内 `/status`、`/sessions` 等控制命令 |
| [安全策略](SECURITY.zh.md) | 凭据、授权与漏洞报告 |
| [English overview](docs/README.en.md) | English product summary |

---

## 适用场景

- 已在本地或服务器运行 **DSH Web Host**（含 [deepseek-harness-mobile](https://github.com/deepseek-ai/deepseek-harness) 移动端发行版）。
- 希望用 **手机微信** 向电脑上的 DSH Agent 下发任务、查看进度、切换会话。
- 不需要注入桌面微信、WxHook 或修改 DSH 核心代码。

```text
  手机微信
      │
      ▼
  腾讯 iLink / ClawBot
      │
      ▼
  dsh-wx-clawbot（本插件，运行于 DSH Host）
      │
      ▼
  DSH Agent ──► 本机工具 / 工作区
```

> **免责声明**  
> 本项目为社区独立集成，**不是**腾讯、微信、DeepSeek 或 DeepSeek Harness 官方产品。  
> 使用腾讯 iLink 接口须遵守腾讯相关服务条款。

---

## 环境要求

| 项 | 要求 |
|----|------|
| Node.js | `>= 22.19` |
| 包管理器 | pnpm（DSH CLI 安装插件时使用） |
| DSH Host | `0.1.0-rc.8` 或更高（推荐 `0.1.1-rc.x`） |
| LLM 凭据 | `$DSH_HOME/.credentials.yaml` 中配置 `DEEPSEEK_API_KEY` |
| 网络 | Host 需能访问腾讯 iLink；配对时手机与电脑在同一局域网或经穿透可达 |

---

## 快速开始

### 方式 A：全局 `dsh` CLI

适用于已安装 `@deepseek-ai/dsh` 或官方 DSH 发行版的环境。

```powershell
# 1. 安装插件到 web Profile（桌面版请换成实际 Profile 名）
dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot

# 2. 启动 DSH Web Host
dsh web

# 3. 打开 http://127.0.0.1:3080，在对话里说：
#    「帮我配置微信」
#    Agent 会调用 wx_configure，按提示扫码即可完成配对
```

### 方式 B：`pnpm dsh`（deepseek-harness-mobile）

适用于从 [deepseek-harness-mobile](https://github.com/deepseek-ai/deepseek-harness) 源码运行的环境。

```powershell
# 0. 进入 deepseek-harness-mobile 仓库根目录
cd path\to\deepseek-harness-mobile

# 1. 安装插件到 web Profile
pnpm dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot

# 2. 启动 Host (:3080) + Mobile PWA (:8030)
pnpm dsh

# 3. 打开 http://127.0.0.1:3080 或手机访问 http://<电脑IP>:8030
#    在对话里说：「帮我配置微信」
```

### 对话式配对流程

Agent 调用内置工具 **`wx_configure`** 自动完成：

| 步骤 | 工具动作 | 说明 |
|------|----------|------|
| 1 | `status` | 检查是否已配对 |
| 2 | `start_pairing` | 生成二维码与配对页路径（Host 模式为相对路径；CLI 独立模式为 `:3081` 绝对 URL） |
| 3 | `pair_step` | 轮询扫码进度；若需数字码则传入 `verify_code` |
| 4 | 完成 | 凭据写入 `$DSH_HOME/.credentials.yaml`，通道自动激活 |

配对页路径：`/api/wx-clawbot/pairing`（Host 内嵌模式下工具输出为**相对路径**，在当前 DSH 站点打开即可；PC `localhost:3080` 与手机隧道 `https://dshmobilexxxxx` 各自解析到同一 Host 路由）。

| 访问方式 | 打开方式 |
|----------|----------|
| 本机 PC（Host 对话） | 在当前页打开 `/api/wx-clawbot/pairing` |
| 手机（Mobile PWA / 隧道） | 在同一域名下打开 `/api/wx-clawbot/pairing` |
| CLI 独立 `wx-clawbot setup` | 终端输出的 `http://<host>:3081/api/wx-clawbot/pairing` 等绝对 URL |

### 验证

```powershell
# 微信里发送
/status

# 或在 Host 对话中再次说
帮我查看微信通道状态
```

---

## 其他安装方式

### 从源码 checkout 安装（开发）

```powershell
# 全局 dsh
git clone https://github.com/guoyihub/dsh-wx-clawbot.git
cd dsh-wx-clawbot
dsh plugin --profile web add --force .

# pnpm dsh（在 deepseek-harness-mobile 目录）
pnpm dsh plugin --profile web add --force E:\path\to\dsh-wx-clawbot
```

### 固定 Release 版本（生产推荐）

在 [Releases](https://github.com/guoyihub/dsh-wx-clawbot/releases) 下载 `.tgz` 后：

```powershell
# 全局 dsh
dsh plugin --profile web add --force .\dsh-wx-clawbot-0.5.0.tgz

# pnpm dsh
pnpm dsh plugin --profile web add --force .\dsh-wx-clawbot-0.5.0.tgz
```

---

## 安装命令对照

| 场景 | 命令 |
|------|------|
| GitHub 直装（dsh） | `dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot` |
| GitHub 直装（pnpm dsh） | `pnpm dsh plugin --profile web add github:guoyihub/dsh-wx-clawbot` |
| 本地路径（dsh） | `dsh plugin --profile web add --force /path/to/dsh-wx-clawbot` |
| 本地路径（pnpm dsh） | `pnpm dsh plugin --profile web add --force /path/to/dsh-wx-clawbot` |
| Release 包 | `… add --force ./dsh-wx-clawbot-x.y.z.tgz` |

安装完成后插件出现在 Profile 的 `dsh.profile.bundles` 中，Cordis 插件 ID 为 **`wx-clawbot`**。

---


## Agent 工具

本插件向 DSH Tool Registry 注册两个工具（无需修改 DSH 核心）：

### `wx_configure`

对话式安装与运维入口。

| `action` | 作用 |
|----------|------|
| `status` | 查看配对、凭据、工作区 |
| `start_pairing` | 开始扫码配对 |
| `pair_step` | 推进配对（可带 `verify_code`） |
| `cancel_pairing` | 取消进行中的配对 |
| `disconnect` | 解除本机配对与凭据 |

### `wx_send`

向已授权微信用户主动发送文本（任务通知、结果推送等）。

---

## CLI（可选）

插件同时提供命令行入口，适合脚本或无 UI 环境：

```powershell
# 在插件目录或 profile node_modules/.bin 下
wx-clawbot setup --agent-cwd D:\your-workspace
wx-clawbot status
wx-clawbot disconnect
```

npm scripts（在插件源码目录）：

```powershell
npm run setup -- --agent-cwd D:\your-workspace
npm run status
npm run disconnect
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

推荐端口规划：

| 服务 | 端口 |
|------|------|
| DSH Host | 3080 |
| Mobile PWA | 8030 |
| 微信 QR 配对（setup / wx_configure） | 3081 |

---

## 开发

```powershell
git clone https://github.com/guoyihub/dsh-wx-clawbot.git
cd dsh-wx-clawbot
npm ci --legacy-peer-deps
npm run check
npm test
```

---

## 安全

请勿在 Issue、日志或对话中粘贴 Bot Token、配对 QR 或用户 ID。  
详见 [SECURITY.zh.md](./SECURITY.zh.md)。

---

## 致谢与 lineage

| 项目 | 关系 |
|------|------|
| [zp-home/dsh-weixin-clawbot](https://github.com/zp-home/dsh-weixin-clawbot) | 原始 Weixin ClawBot DSH 适配实现 |
| [deepseek-harness / deepseek-harness-mobile](https://github.com/deepseek-ai/deepseek-harness) | 运行时 Host 与 Mobile 集成验证目标 |
| 腾讯 Weixin ClawBot / iLink | 官方消息通道 |

当前仓库在原始项目基础上演进为 `wx-clawbot` 插件 ID，并新增 `wx_configure` 对话式配置能力。

---

## License

[MIT](./LICENSE) — Copyright (c) 2026 zp-home and contributors.  
See [NOTICE.md](./NOTICE.md) for lineage and third-party notices.
