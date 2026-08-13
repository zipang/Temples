# AGENTS.md

## Read the README

Each root directory contains a `README.md` that explains its content and is an easy-to-read way to discover the project's structure for humans and AI coding agents alike. The `README.md` also contains the conventions used inside this directory. For technical automated workflows a separate `AGENTS.md` can be found aside (not mandatory).
Always read the `README.md` first before making any change inside the directory.
If architectural decisions change the way things are done, always ensure that the `README.md` contains the latest content and conventions.

## Agent Skills

This project uses a set of agent skills that encode the engineering workflow. They live in `.agents/skills/` and are loaded on demand. This file documents how they are discovered, how to pick the right one, and the operating behaviors that apply to all of them.
Skills are workflows, not suggestions — follow the steps in order and don't skip their verification steps. Multiple skills can apply to a single task (e.g. `spec-driven-development` → `planning-and-task-breakdown` → `incremental-implementation` → `test-driven-development` → `code-review-and-quality`).

### Skill Discovery

When a task arrives, identify the phase and apply the corresponding skill:

```
Task arrives
    │
    ├── Don't know what you want yet? ──────→ interview-me
    ├── Have a rough concept? ─────────────→ idea-refine
    ├── New project/feature/change? ────────→ spec-driven-development
    ├── Have a spec, need tasks? ───────────→ planning-and-task-breakdown
    ├── Implementing code? ────────────────→ incremental-implementation
    │   ├── API/module-boundary work? ─────→ api-and-interface-design
    │   ├── Need better context? ──────────→ context-engineering
    │   ├── Need doc-verified code? ───────→ source-driven-development
    │   ├── Stakes high / unfamiliar code? → doubt-driven-development
    │   └── JS/TS tooling? ────────────────→ use-bun
    ├── Writing/running tests? ─────────────→ test-driven-development
    │   └── Testing/debugging real web app pages? → agent-browser
    ├── Reviewing code? ───────────────────→ code-review-and-quality
    │   └── Too complex? ──────────────────→ code-simplification
    ├── Writing docs, instructions or comments? → technical-writing
```

**When in doubt, start with a spec.** If a task is non-trivial and has no spec, begin with `spec-driven-development`.
Not every task needs every step. A bug fix might only need: `test-driven-development` → `code-review-and-quality`.

### Operating Behaviors

These behaviors apply at all times, across all skills. They are non-negotiable. The right column lists the failure mode each behavior avoids.

| Do | Don't |
|----|-------|
| Surface assumptions before non-trivial work and give the human a chance to correct them. | Fill ambiguous requirements silently, or build without a spec because "it's obvious". |
| Manage confusion actively. STOP, name the confusion, present the tradeoff, wait for resolution. | Plow ahead when lost, or hide inconsistencies you notice. |
| Push back when warranted, with concrete downsides and alternatives. | Be a yes-machine, or hide tradeoffs on non-obvious decisions. |
| Enforce simplicity. Prefer the boring, obvious solution. | Overcomplicate code and APIs. |
| Maintain scope discipline. Touch only what you are asked to touch. | Modify code or comments unrelated to the task, or remove things you don't fully understand. |
| Verify, don't assume. A task is done only when evidence passes. | Skip verification because "it looks right". |

### Quick Reference

| Phase | Skill | One-Line Summary |
|-------|-------|------------------|
| Define | `interview-me` | Extract what the user actually wants before any plan, spec, or code exists |
| Define | `idea-refine` | Refine raw ideas through structured divergent and convergent thinking |
| Define | `spec-driven-development` | Requirements and acceptance criteria before code |
| Plan | `planning-and-task-breakdown` | Decompose work into small, verifiable tasks |
| Build | `incremental-implementation` | Thin vertical slices, test each before expanding |
| Build | `api-and-interface-design` | Stable interfaces with clear contracts |
| Build | `source-driven-development` | Verify against official docs before implementing |
| Build | `doubt-driven-development` | Adversarial fresh-context review of non-trivial decisions |
| Build | `context-engineering` | Right context at the right time |
| Tooling | `use-bun` | Use Bun instead of Node.js tooling |
| Verify | `test-driven-development` | Failing test first, then make it pass |
| Verify | `agent-browser` | Test/debug real web pages & components in a browser |
| Review | `code-review-and-quality` | Multi-axis code review before merge |
| Review | `code-simplification` | Preserve behavior while reducing unnecessary complexity |
| Write | `technical-writing` | Technical prose in Simplified Technical English (STE) |

## Technical Writing

All technical prose in this project is written with the `technical-writing` skill, which enforces Simplified Technical English (STE).
It applies to **every** written artifact, not just documentation:

- `README.md` files
- `AGENTS.md` files and agent skill instructions
- JSDoc and code comments
- Pull-request descriptions and commit messages
- Error messages

The same discipline applies whether you write new text or review existing text.
Text inside code (identifiers, shell commands, markup) stays verbatim — STE applies to the sentences around them, not to the tokens.

## Browser Testing

The `agent-browser` skill (`agent-browser` CLI in `.agents/skills/agent-browser/`) is used for testing and debugging real web pages — especially our web components. It automates Chrome/Chromium via CDP with accessibility-tree snapshots. Install with `bun add -g agent-browser && agent-browser install`, then load the up-to-date workflow via `agent-browser skills get core` (the SKILL.md is a discovery stub).

## Bun Tooling

The authoritative Bun guidance (script usage, APIs, testing, and frontend HTML imports) lives in the `use-bun` skill in `.agents/skills/use-bun/`. Default to Bun instead of Node.js — that skill is a superset of this project's tooling rules and is loaded whenever JS/TS tasks arise.

## Code Style: linting, formating

This project uses [Biome](https://biomejs.dev/) for formatting and linting.
Formatting rules are declared in [`.editorconfig`](.editorconfig) (minimal, editor-agnostic) and enforced by [`biome.jsonc`](biome.jsonc).

### Additional style requirements (check these in any code review)

- Declare a JSDoc block for every function.
- Prefer arrow function definitions: `const fn = () => {}`. Do not use the `function` keyword.
- _Always_ leave a blank line before a test statement or a loop statement. This helps identify the branching points.

### Commands

| Command | Description |
|---------|-------------|
| `bun run check` | Run formatter + linter (reports violations, no changes) |
| `bun run format` | Format all files in place (writes changes) |
| `bun run lint` | Run linter only |
| `bun run typecheck` | TypeScript type checking (`tsc --noEmit`) |

**Before declaring any task complete, run `bun run check` and `bun run typecheck`. Both must pass with zero errors.**
**Write conformant code from the start** — do not defer to code review.
