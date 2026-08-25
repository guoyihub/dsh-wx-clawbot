export function collectAgentReply(events, firstSeq) {
  let started = false
  let text = ''
  let reason
  for (const event of events) {
    if (event.seq < firstSeq) continue
    if (event.type === 'turn/start') {
      started = true
      continue
    }
    if (!started) continue
    if (event.type === 'assistant/message') {
      const current = event.data.message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('')
        .trim()
      if (current) text = current
    }
    if (event.type === 'turn/end') reason = event.data.reason
  }
  return { text, reason }
}

export function limitText(value, maxChars) {
  const text = String(value ?? '').replace(/\u0000/g, '').trim()
  const chars = Array.from(text)
  if (chars.length <= maxChars) return text
  return `${chars.slice(0, Math.max(1, maxChars - 1)).join('').trimEnd()}…`
}
