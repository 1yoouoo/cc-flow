# cc-flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Claude Code 멀티에이전트 실행을 터미널 트리 TUI로 실시간 시각화하는 npm 플러그인 빌드

**Architecture:** Claude Code의 PreToolUse/PostToolUse 훅이 Agent 툴 호출을 감지해 `~/.cc-flow/events.jsonl`에 이벤트를 기록한다. `cc-flow watch` 명령이 별도 터미널에서 Ink TUI로 해당 파일을 실시간 감시하며 트리를 렌더링한다.

**Tech Stack:** Node.js, Ink (React TUI), Commander.js, npm

---

### Task 1: 프로젝트 초기화

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.babelrc`

**Step 1: package.json 생성**

```bash
cd /Users/blanc/Documents/Project/cc-flow
npm init -y
```

**Step 2: 의존성 설치**

```bash
npm install ink react commander
npm install --save-dev @babel/core @babel/preset-react @babel/preset-env @babel/register
```

**Step 3: package.json 수정** — `bin`, `type`, `scripts` 추가

```json
{
  "name": "cc-flow",
  "version": "0.1.0",
  "description": "Terminal UI for Claude Code multi-agent execution flow",
  "main": "src/cli.js",
  "bin": {
    "cc-flow": "src/cli.js"
  },
  "scripts": {
    "start": "node src/cli.js",
    "test": "node --experimental-vm-modules node_modules/.bin/jest"
  },
  "keywords": ["claude-code", "agent", "tui", "visualization"],
  "license": "MIT"
}
```

**Step 4: .babelrc 생성**

```json
{
  "presets": [
    "@babel/preset-env",
    "@babel/preset-react"
  ]
}
```

**Step 5: .gitignore 생성**

```
node_modules/
*.log
```

**Step 6: 커밋**

```bash
git add package.json .gitignore .babelrc package-lock.json
git commit -m "chore: initialize cc-flow project"
```

---

### Task 2: hook.js — 이벤트 기록 스크립트

Claude Code 훅이 호출하는 스크립트. stdin으로 JSON을 받아 events.jsonl에 기록하고 depth를 관리한다.

**Files:**
- Create: `src/hook.js`

**Step 1: hook.js 작성**

```js
#!/usr/bin/env node
// src/hook.js
// Called by Claude Code hooks: node hook.js pre | node hook.js post
// Reads JSON from stdin, writes event to ~/.cc-flow/events.jsonl

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

  let input = ''
  process.stdin.on('data', chunk => { input += chunk })
  process.stdin.on('end', () => {
    let data = {}
    try { data = JSON.parse(input) } catch { /* not JSON, ignore */ }

    const toolName = data.tool_name || data.hook_event_name || ''
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
```

> **주의**: `id` 매칭이 완벽하지 않다 (pre/post가 다른 프로세스). Task 3의 TUI에서 name+depth 기반으로 트리를 구성한다.

**Step 2: 수동 테스트**

```bash
echo '{"tool_name":"Agent","tool_input":{"description":"idea-picker"}}' | node src/hook.js pre
cat ~/.cc-flow/events.jsonl
# 예상: {"type":"start","id":"...","name":"idea-picker","depth":0,"ts":...}
```

**Step 3: 커밋**

```bash
git add src/hook.js
git commit -m "feat: add hook.js for capturing Agent tool events"
```

---

### Task 3: TUI — App.jsx, TreeNode.jsx, ProgressBar.jsx

**Files:**
- Create: `src/tui/App.jsx`
- Create: `src/tui/TreeNode.jsx`
- Create: `src/tui/ProgressBar.jsx`

**Step 1: ProgressBar.jsx 작성**

```jsx
// src/tui/ProgressBar.jsx
import React from 'react'
import { Text, Box } from 'ink'

export function ProgressBar({ done, total }) {
  const width = 20
  const filled = total > 0 ? Math.round((done / total) * width) : 0
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <Box>
      <Text dimColor>{done}/{total} complete  </Text>
      <Text color="green">{bar}</Text>
      <Text dimColor>  {pct}%</Text>
    </Box>
  )
}
```

**Step 2: TreeNode.jsx 작성**

```jsx
// src/tui/TreeNode.jsx
import React from 'react'
import { Text, Box } from 'ink'

const STATUS_ICON = {
  running: '⟳',
  done: '✓',
  pending: '⏳',
  error: '✗',
}

const STATUS_COLOR = {
  running: 'cyan',
  done: 'green',
  pending: 'gray',
  error: 'red',
}

export function TreeNode({ node, depth = 0, isLast = false }) {
  const indent = '│   '.repeat(depth)
  const branch = depth === 0 ? '' : (isLast ? '└── ' : '├── ')
  const icon = STATUS_ICON[node.status] || '?'
  const color = STATUS_COLOR[node.status] || 'white'

  const elapsed = node.ms != null
    ? `[${(node.ms / 1000).toFixed(1)}s]`
    : node.status === 'running'
      ? `[${Math.round((Date.now() - node.startedAt) / 1000)}s elapsed]`
      : ''

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{indent}{branch}</Text>
        <Text color={color}>{icon} {node.name}</Text>
        {elapsed ? <Text dimColor>  {elapsed}</Text> : null}
      </Box>
      {node.children.map((child, i) => (
        <TreeNode
          key={child.key}
          node={child}
          depth={depth + 1}
          isLast={i === node.children.length - 1}
        />
      ))}
    </Box>
  )
}
```

**Step 3: App.jsx 작성**

```jsx
// src/tui/App.jsx
import React, { useState, useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { TreeNode } from './TreeNode.jsx'
import { ProgressBar } from './ProgressBar.jsx'

const EVENTS_FILE = path.join(os.homedir(), '.cc-flow', 'events.jsonl')

function parseEvents(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean)
    return lines.map(l => JSON.parse(l))
  } catch {
    return []
  }
}

function buildTree(events) {
  // Stack-based tree builder using depth
  const roots = []
  const stack = [] // stack of nodes at each depth level

  // Group start events; match ends by name+depth (best effort)
  const endMap = {} // "name:depth" -> [ms, ...]
  for (const e of events) {
    if (e.type === 'end') {
      const key = `${e.name}:${e.depth}`
      if (!endMap[key]) endMap[key] = []
      endMap[key].push(e)
    }
  }

  let nodeCounter = 0
  for (const e of events) {
    if (e.type !== 'start') continue

    const endKey = `${e.name}:${e.depth}`
    const endEvent = endMap[endKey] ? endMap[endKey].shift() : null

    const node = {
      key: `node-${nodeCounter++}`,
      name: e.name,
      depth: e.depth,
      startedAt: e.ts,
      ms: endEvent ? endEvent.ts - e.ts : null,
      status: endEvent ? 'done' : 'running',
      children: [],
    }

    // Find parent: last node in stack with depth = e.depth - 1
    while (stack.length > 0 && stack[stack.length - 1].depth >= e.depth) {
      stack.pop()
    }

    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1].children.push(node)
    }

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
    total += t
    done += d
  }
  return [total, done]
}

export function App() {
  const [tree, setTree] = useState([])
  const [tick, setTick] = useState(0)
  const { exit } = useApp()

  useEffect(() => {
    const rebuild = () => {
      const events = parseEvents(EVENTS_FILE)
      setTree(buildTree(events))
    }

    rebuild()

    if (!fs.existsSync(EVENTS_FILE)) {
      fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true })
      fs.writeFileSync(EVENTS_FILE, '')
    }

    const watcher = fs.watch(EVENTS_FILE, () => rebuild())

    // Tick every second to update elapsed times
    const ticker = setInterval(() => setTick(t => t + 1), 1000)

    const onKey = (data) => {
      if (data.toString() === 'q' || data.toString() === '\x03') exit()
    }
    process.stdin.on('data', onKey)

    return () => {
      watcher.close()
      clearInterval(ticker)
      process.stdin.off('data', onKey)
    }
  }, [])

  const now = new Date().toLocaleTimeString()
  const [total, done] = countNodes(tree)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">Claude Code Flow</Text>
        <Text dimColor>{now}</Text>
      </Box>
      <Text> </Text>
      {tree.length === 0
        ? <Text dimColor>  Waiting for agents... (run Claude Code in another terminal)</Text>
        : tree.map((node, i) => (
            <TreeNode key={node.key} node={node} depth={0} isLast={i === tree.length - 1} />
          ))
      }
      <Text> </Text>
      <ProgressBar done={done} total={total} />
      <Text dimColor>  Press q to quit</Text>
    </Box>
  )
}
```

**Step 4: 커밋**

```bash
git add src/tui/
git commit -m "feat: add Ink TUI components (App, TreeNode, ProgressBar)"
```

---

### Task 4: setup.js — Claude Code 훅 등록

**Files:**
- Create: `src/setup.js`

**Step 1: setup.js 작성**

```js
// src/setup.js
const fs = require('fs')
const path = require('path')
const os = require('os')

const SETTINGS_PATHS = [
  path.join(os.homedir(), '.claude', 'settings.json'),
  path.join(process.cwd(), '.claude', 'settings.json'),
]

function findHookScript() {
  // npm global install 경로
  return require.resolve('./hook.js')
}

function addHooks(settingsPath, hookScript) {
  let settings = {}
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) } catch {}
  }

  if (!settings.hooks) settings.hooks = {}

  const hookEntry = (mode) => ({
    type: 'command',
    command: `node ${hookScript} ${mode}`,
  })

  const addHookType = (type, mode) => {
    if (!settings.hooks[type]) settings.hooks[type] = []
    const exists = settings.hooks[type].some(
      h => h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('cc-flow'))
    )
    if (!exists) {
      settings.hooks[type].push({
        matcher: 'Agent',
        hooks: [hookEntry(mode)],
      })
    }
  }

  addHookType('PreToolUse', 'pre')
  addHookType('PostToolUse', 'post')

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  console.log(`✓ Hooks registered in ${settingsPath}`)
}

function setup() {
  const hookScript = findHookScript()
  const target = SETTINGS_PATHS[0] // 글로벌 설정

  addHooks(target, hookScript)
  console.log('\n✓ cc-flow setup complete!')
  console.log('  Run "cc-flow watch" in a separate terminal before your next Claude Code session.\n')
}

module.exports = { setup }
```

**Step 2: 수동 테스트**

```bash
node -e "require('./src/setup.js').setup()"
cat ~/.claude/settings.json | grep -A 10 hooks
```

**Step 3: 커밋**

```bash
git add src/setup.js
git commit -m "feat: add setup.js for Claude Code hook registration"
```

---

### Task 5: cli.js — 진입점

**Files:**
- Create: `src/cli.js`

**Step 1: cli.js 작성**

```js
#!/usr/bin/env node
// src/cli.js
require('@babel/register')({
  extensions: ['.js', '.jsx'],
})

const { program } = require('commander')
const { version } = require('../package.json')

program
  .name('cc-flow')
  .description('Terminal UI for Claude Code multi-agent execution flow')
  .version(version)

program
  .command('watch')
  .description('Start the TUI in this terminal')
  .action(() => {
    const { render } = require('ink')
    const React = require('react')
    const { App } = require('./tui/App.jsx')
    render(React.createElement(App))
  })

program
  .command('setup')
  .description('Register Claude Code hooks in ~/.claude/settings.json')
  .action(() => {
    const { setup } = require('./setup.js')
    setup()
  })

program
  .command('clear')
  .description('Clear events log and reset depth counter')
  .action(() => {
    const fs = require('fs')
    const path = require('path')
    const os = require('os')
    const dir = path.join(os.homedir(), '.cc-flow')
    const eventsFile = path.join(dir, 'events.jsonl')
    const depthFile = path.join(dir, 'depth')
    if (fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, '')
    if (fs.existsSync(depthFile)) fs.writeFileSync(depthFile, '0')
    console.log('✓ Cleared events and reset depth')
  })

program.parse()
```

**Step 2: 실행 권한 부여**

```bash
chmod +x src/cli.js
```

**Step 3: 로컬 테스트**

```bash
node src/cli.js --help
node src/cli.js clear
node src/cli.js watch
# q로 종료
```

**Step 4: 커밋**

```bash
git add src/cli.js
git commit -m "feat: add cli.js with watch/setup/clear commands"
```

---

### Task 6: README.md

**Files:**
- Create: `README.md`

**Step 1: README 작성**

```markdown
# cc-flow

> Terminal UI for Claude Code multi-agent execution flow

Watch your Claude Code agents run in real-time — parallel and sequential flows visualized as a live tree.

## Demo

```
╭─ Claude Code Flow ──────────────────── 14:32:05 ─╮
│                                                    │
│  ⟳ batch-orchestrator                             │
│  ├── ✓ idea-picker          [0.8s]                │
│  ├── ⟳ hey-its-me-orchestrator                   │
│  │   ├── ✓ image-generator  [12.3s]               │
│  │   └── ⟳ video-converter  [8s elapsed]          │
│  └── ⏳ shorts-composer                           │
│                                                    │
│  3/5 complete  ████████░░  60%                    │
╰────────────────────────────────────────────────────╯
```

## Install

```bash
npm install -g cc-flow
```

## Usage

```bash
# 1. Register Claude Code hooks (one-time setup)
cc-flow setup

# 2. Open a new terminal and run
cc-flow watch

# 3. Run your Claude Code agent pipeline normally
# The tree appears automatically

# Clear history between runs
cc-flow clear
```

## How It Works

cc-flow hooks into Claude Code's `PreToolUse` / `PostToolUse` events for the `Agent` tool.
Each hook call writes a JSON event to `~/.cc-flow/events.jsonl`.
`cc-flow watch` tails that file and renders a live tree with [Ink](https://github.com/vadimdemedes/ink).

## Requirements

- Node.js 18+
- Claude Code

## License

MIT
```

**Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: add README with usage and demo"
```

---

### Task 7: End-to-End 검증

**Step 1: 로컬 npm link**

```bash
cd /Users/blanc/Documents/Project/cc-flow
npm link
```

**Step 2: setup 실행 및 확인**

```bash
cc-flow setup
cat ~/.claude/settings.json | python3 -m json.tool | grep -A 15 hooks
```

**Step 3: 더미 이벤트로 TUI 테스트**

터미널 1:
```bash
cc-flow clear && cc-flow watch
```

터미널 2:
```bash
# 더미 이벤트 주입
echo '{"tool_name":"Agent","tool_input":{"description":"batch-orchestrator"}}' | node /Users/blanc/Documents/Project/cc-flow/src/hook.js pre
sleep 1
echo '{"tool_name":"Agent","tool_input":{"description":"idea-picker"}}' | node /Users/blanc/Documents/Project/cc-flow/src/hook.js pre
sleep 0.8
echo '{"tool_name":"Agent","tool_input":{"description":"idea-picker"}}' | node /Users/blanc/Documents/Project/cc-flow/src/hook.js post
sleep 0.2
echo '{"tool_name":"Agent","tool_input":{"description":"image-generator"}}' | node /Users/blanc/Documents/Project/cc-flow/src/hook.js pre
```

터미널 1에서 트리가 실시간으로 업데이트되는지 확인.

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "chore: finalize cc-flow v0.1.0"
```
