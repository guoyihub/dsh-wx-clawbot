import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDoctorReport, formatQueueReport, formatTaskReport } from '../src/runtime-status.js'

test('task and queue reports expose current runtime state', () => {
  const now = Date.now()
  const task = {
    state: 'running', title: '检查项目', startedAt: new Date(Date.now() - 65_000).toISOString(), finishedAt: null, error: null,
  }
  const taskReport = formatTaskReport(task, now)

  assert.match(taskReport, /任务：运行中/)
  assert.match(taskReport, /内容：检查项目/)
  assert.match(taskReport, /1 分/)
  assert.equal(formatQueueReport(3, true), '当前任务：运行中\n等待消息：2')
  assert.equal(formatTaskReport(undefined), '还没有任务记录。直接发送文字即可开始。')
})

test('doctor report is sanitized and exposes optional capability health', () => {
  const report = formatDoctorReport({
    paired: true,
    poll: '08/22 12:00 成功',
    consecutivePollFailures: 2,
    queueDepth: 3,
    outboxDepth: 4,
    startedAt: new Date(Date.now() - 5_000).toISOString(),
    capabilities: 'commands:有，llm:无',
    lastPollError: 'network unavailable',
    now: Date.now(),
  })

  assert.match(report, /DSH 微信通道诊断/)
  assert.match(report, /配对：正常/)
  assert.match(report, /连续失败：2/)
  assert.match(report, /待发送回复：4/)
  assert.match(report, /commands:有/)
  assert.match(report, /最近错误：network unavailable/)
})
