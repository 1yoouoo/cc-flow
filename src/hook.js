#!/usr/bin/env node
// src/hook.js
const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')

const CC_FLOW_DIR = path.join(os.homedir(), '.cc-flow')
const EVENTS_FILE = path.join(CC_FLOW_DIR, 'events.jsonl')
const DEPTH_FILE = path.join(CC_FLOW_DIR, 'depth')

function ensureDir() {
  if (!fs.existsSync(CC_FLOW_DIR)) {
    fs.mkdirSync(CC_FLOW_DIR, { recursive: true })
  }
}

function readDepth() {
  try {
    return parseInt(fs.readFileSync(DEPTH_FILE, 'utf8').trim(), 10) || 0
  } catch {
    return 0
  }
}

function writeDepth(depth) {
  fs.writeFileSync(DEPTH_FILE, String(Math.max(0, depth)))
}

function appendEvent(event) {
  fs.appendFileSync(EVENTS_FILE, JSON.stringify(event) + '\n')
}

function main() {
  ensureDir()

  const mode = process.argv[2] // 'pre' or 'post'
  if (mode !== 'pre' && mode !== 'post') process.exit(0)

  let input = ''
  process.stdin.on('data', chunk => { input += chunk })
  process.stdin.on('end', () => {
    let data = {}
    try { data = JSON.parse(input) } catch { return }

    const toolName = data.tool_name || ''
    if (toolName !== 'Agent') return

    const toolInput = data.tool_input || {}
    const agentName = toolInput.description || toolInput.subagent_type || 'unknown'
    const id = crypto.randomUUID()

    if (mode === 'pre') {
      const depth = readDepth()
      appendEvent({ type: 'start', id, name: agentName, depth, ts: Date.now() })
      writeDepth(depth + 1)
    } else if (mode === 'post') {
      const depth = Math.max(0, readDepth() - 1)
      writeDepth(depth)
      appendEvent({ type: 'end', id: 'end-' + id, name: agentName, depth, ts: Date.now() })
    }
  })
}

main()
