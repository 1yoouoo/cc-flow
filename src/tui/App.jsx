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
