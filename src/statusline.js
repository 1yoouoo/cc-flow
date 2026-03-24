#!/usr/bin/env node
// src/statusline.js
const fs = require('fs')
const path = require('path')
const os = require('os')

const EVENTS_FILE = path.join(os.homedir(), '.cc-flow', 'events.jsonl')

// ANSI helpers
const cyan = s => `\x1b[36m${s}\x1b[0m`
const green = s => `\x1b[32m${s}\x1b[0m`
const dim = s => `\x1b[2m${s}\x1b[0m`

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function spinner() {
  return cyan(SPINNER_FRAMES[Math.floor(Date.now() / 100) % SPINNER_FRAMES.length])
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function parseEvents() {
  try {
    const lines = fs.readFileSync(EVENTS_FILE, 'utf8').trim().split('\n').filter(Boolean)
    return lines.map(l => JSON.parse(l))
  } catch {
    return []
  }
}

function buildTree(events) {
  const roots = []
  const stack = []
  const endMap = {}

  for (const e of events) {
    if (e.type === 'end') {
      const key = `${e.name}:${e.depth}`
      if (!endMap[key]) endMap[key] = []
      endMap[key].push(e)
    }
  }

  let counter = 0
  for (const e of events) {
    if (e.type !== 'start') continue
    const endKey = `${e.name}:${e.depth}`
    const endEvent = endMap[endKey] ? endMap[endKey].shift() : null

    const node = {
      key: counter++,
      name: e.name,
      depth: e.depth,
      status: endEvent ? 'done' : 'running',
      children: [],
    }

    while (stack.length > 0 && stack[stack.length - 1].depth >= e.depth) stack.pop()
    if (stack.length === 0) roots.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }

  return roots
}

function countNodes(nodes) {
  let total = 0, done = 0
  for (const n of nodes) {
    total++
    if (n.status === 'done') done++
    const [t, d] = countNodes(n.children)
    total += t; done += d
  }
  return [total, done]
}

function findRunningPath(nodes) {
  // Returns array of names from root to deepest running node
  for (const node of nodes) {
    if (node.status === 'running') {
      const childPath = findRunningPath(node.children)
      return [node.name, ...childPath]
    }
  }
  return []
}

function progressBar(done, total, width = 10) {
  const filled = total > 0 ? Math.min(width, Math.round((done / total) * width)) : 0
  return '━'.repeat(filled) + '░'.repeat(width - filled)
}

function main() {
  const events = parseEvents()
  if (events.length === 0) return

  const tree = buildTree(events)
  const runningPath = findRunningPath(tree)

  if (runningPath.length === 0) return // all done, hide statusline

  const [total, done] = countNodes(tree)
  const pathStr = runningPath.join(dim(' › '))
  const bar = progressBar(done, total)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const startTs = events.find(e => e.type === 'start')?.ts ?? Date.now()
  const elapsed = formatElapsed(Date.now() - startTs)

  process.stdout.write(
    `${spinner()} ${pathStr}  ${green(bar)}  ${dim(`${done}/${total}`)}  ${dim(`${pct}%`)}  ${dim(elapsed)}`
  )
}

main()
