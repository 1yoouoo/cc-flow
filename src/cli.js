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
