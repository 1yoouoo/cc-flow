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
