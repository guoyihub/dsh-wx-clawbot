# 安全策略

[English](SECURITY.md) | [中文首页](README.md)

## 支持版本

安全修复应用于默认分支上的最新发行版本。

## 报告漏洞

请使用 GitHub 私有漏洞报告。不要在公开 Issue 中提交 Bot Token、credential 文件、
iLink 游标、用户标识、本地路径或未脱敏日志。

## 远程控制边界

- 本机扫码账号成为主用户。只有主用户可生成 10 分钟一次性邀请码、查看用户、撤销
  非主用户或读取审计事件。
- 未授权发送者在 Agent 解析前被丢弃。无效邀请码不回复，避免形成鉴权探测接口。
- Bot Token 只保存在 DSH credentials 中，不写入插件状态。
- 新会话默认 `workspace-write`。越界操作生成绑定用户、有效 5 分钟且只能使用一次的
  审批码。
- 审批超时、任务取消、桥接停止、发送失败或无效决策均默认拒绝；`allowed-once`
  不会修改会话权限。
- `danger-full-access` 必须发送精确命令
  `/permission danger-full-access confirm`，并写入审计。
- 审批监听器只拥有手机创建/恢复的 Agent；借用 Web/桌面 Agent 时交给下一个 DSH
  审批处理器。
- 用户会话索引和审批码相互隔离，不能选择、审批或撤销其他用户的资源。
- 状态文件及其父目录必须保持私有。Outbox 不含 Bot Token，但可能包含用户和模型
  回复文本。

分享诊断前，应脱敏 `$DSH_HOME/.credentials.yaml`、
`$DSH_HOME/wx-clawbot/state.json`、配对二维码、Authorization Header、本地路径和
Session 日志中的个人内容。

本项目不安装 Windows 开机启动项、计划任务或系统服务。持久 DSH Host 的启动和
主机安全仍由使用者负责。
