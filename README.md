# agentflow

> Real-time agent orchestration visualizer for Claude Code

Watch your Claude Code agents run in real-time — parallel and sequential flows shown as a live status line at the bottom of your terminal.

## Demo

```
⠙ batch-orchestrator › video-converter  ━━━━━━░░░░  3/8  37%  1m 23s
```

Automatically appears in Claude Code's status bar whenever agents are running. No separate terminal needed.

## Install

```bash
npm install -g agentflow
```

## Usage

```bash
# One-time setup — registers hooks in Claude Code
agentflow setup

# That's it. Run Claude Code normally and the status line appears automatically.

# Optional: view full agent tree
agentflow watch

# Clear history between runs
agentflow clear
```

## How It Works

agentflow hooks into Claude Code's `PreToolUse` / `PostToolUse` events for the `Agent` tool.
Each hook call writes a JSON event to `~/.cc-flow/events.jsonl`.

The native Claude Code `statusLine` feature reads that file on every refresh and renders:
- Animated spinner showing active state
- Current agent execution path (root › parent › child)
- Thin progress bar + completion count
- Elapsed time since the run started

Parent/child relationships are inferred from call depth — when one agent spawns another,
the nesting appears automatically.

## Requirements

- Node.js 18+
- Claude Code

## License

MIT
