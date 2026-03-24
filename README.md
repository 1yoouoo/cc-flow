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

Parent/child relationships are inferred from call depth — when one agent spawns another,
the nesting appears automatically in the tree.

## Requirements

- Node.js 18+
- Claude Code

## License

MIT
