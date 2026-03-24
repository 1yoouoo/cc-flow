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
