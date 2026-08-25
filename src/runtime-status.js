export function elapsedText(startedAt, now = Date.now()) {
  const elapsed = Math.max(0, now - Date.parse(startedAt))
  const seconds = Math.floor(elapsed / 1000)
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes} 分 ${rest} 秒`
}

export function taskStateText(state) {
  return ({ starting: '准备中', running: '运行中', cancelling: '正在取消', completed: '已完成', cancelled: '已取消', failed: '失败' })[state] ?? state
}

export function formatTaskReport(task, now = Date.now()) {
  if (!task) return '还没有任务记录。直接发送文字即可开始。'
  const lines = [
    `任务：${taskStateText(task.state)}`,
    `内容：${task.title}`,
    `耗时：${elapsedText(task.startedAt, task.finishedAt ? Date.parse(task.finishedAt) : now)}`,
  ]
  if (task.error) lines.push(`错误：${task.error}`)
  return lines.join('\n')
}

export function formatQueueReport(depth, running) {
  const waiting = Math.max(0, depth - (running ? 1 : 0))
  return `当前任务：${running ? '运行中' : '空闲'}\n等待消息：${waiting}`
}

export function formatDoctorReport(input) {
  const lines = [
    'DSH 微信通道诊断',
    `配对：${input.paired ? '正常' : '未配对'}`,
    `轮询：${input.poll}`,
    `连续失败：${input.consecutivePollFailures}`,
    `队列：${input.queueDepth}`,
    `待发送回复：${input.outboxDepth}`,
    `运行时间：${elapsedText(input.startedAt, input.now)}`,
    `可选能力：${input.capabilities}`,
  ]
  if (input.lastPollError) lines.push(`最近错误：${input.lastPollError}`)
  return lines.join('\n')
}
