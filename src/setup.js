// src/setup.js
const fs = require('fs')
const path = require('path')
const os = require('os')

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')

function getHookScriptPath() {
  return path.resolve(__dirname, 'hook.js')
}

function readSettings(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new Error(`Failed to parse ${filePath}: ${err.message}. Fix or delete it and re-run setup.`)
    }
    return {}
  }
}

function isAlreadyRegistered(hookList) {
  return hookList.some(
    entry => entry.hooks && entry.hooks.some(h => h.command && h.command.includes('cc-flow'))
  )
}

function addHookEntry(hookList, hookScript, mode) {
  if (isAlreadyRegistered(hookList)) return
  hookList.push({
    matcher: 'Agent',
    hooks: [{ type: 'command', command: `${process.execPath} ${hookScript} ${mode}` }],
  })
}

function setup() {
  const hookScript = getHookScriptPath()
  const statusLineScript = path.resolve(__dirname, 'statusline.js')
  const settings = readSettings(SETTINGS_PATH)

  if (!settings.hooks) settings.hooks = {}
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = []
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = []

  addHookEntry(settings.hooks.PreToolUse, hookScript, 'pre')
  addHookEntry(settings.hooks.PostToolUse, hookScript, 'post')

  // Register statusLine
  if (!settings.statusLine) {
    settings.statusLine = {
      type: 'command',
      command: `${process.execPath} ${statusLineScript}`,
    }
    console.log('✓ Status line registered')
  } else {
    console.log('  Status line already configured, skipping')
  }

  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))

  console.log(`✓ Hooks registered in ${SETTINGS_PATH}`)
  console.log('  Hook script:', hookScript)
  console.log('\n✓ cc-flow setup complete!')
  console.log('  Run "cc-flow watch" in a separate terminal before your next Claude Code session.\n')
}

module.exports = { setup }
