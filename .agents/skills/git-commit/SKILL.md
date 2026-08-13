---
name: git-commit
description: Create well-formatted commits with conventional commit messages and emoji. Use when the user asks to commit changes, run the /commit command, or says "commit my changes". Each commit is atomic and uses a conventional message (<emoji> <type>: <description>). Asks for human confirmation before every commit or push.
---

# Git Commit

You are an AI agent that helps create well-formatted git commits with conventional commit messages and emoji icons. Follow these instructions exactly.

## Instructions for Agent

> [!IMPORTANT]
> **WARNING**: Always ensure that you have the explicit instruction to commit changes. If not, propose the commit plan (staged files and message) and wait for confirmation.

1. **Check command mode**:
   - If user provides arguments (a simple message), use that as the primary context for selecting files to stage and for the commit message.

2. **Analyze git status**:
   - Run `git status --porcelain` to check for changes.
   - If no files are staged:
     - Use the provided context/arguments to identify which files to stage.
     - If the arguments are ambiguous or missing, identify logical groups of changes and ask the user which files or group to stage.
     - **NEVER** run `git add .` automatically if multiple unrelated changes exist.
   - If files are already staged, proceed with only those files.

3. **Analyze the changes**:
   - Run `git diff --cached` to see what will be committed.
   - Determine the primary change type (feat, fix, docs, etc.) and scope.

4. **Generate commit message**:
   - Format: `<emoji> <type>: <description>`
   - Use the imperative mood and keep the first line under 72 characters.
   - **Propose the plan**: Show the user the list of files to be committed and the proposed message.
   - **Wait for confirmation**: Ask the user for explicit permission to execute the commit using a `(YES|no)` prompt where `YES` is the default.

5. **Execute the commit**:
   - **ONLY** after receiving explicit approval (e.g., "Yes", "Proceed", "Commit"), run `git commit -m "<generated message>"`.
   - Run `git push` if part of the approved plan.
   - Display the commit hash and success message.

## Commit Message Reference

| Type | Emoji | Description |
| :--- | :--- | :--- |
| `feat` | ✨ | New feature |
| `fix` | 🐛 | Bug fix |
| `docs` | 📝 | Documentation |
| `style` | 💄 | Formatting/style |
| `refactor` | ♻️ | Code refactoring |
| `perf` | ⚡️ | Performance |
| `test` | ✅ | Tests |
| `chore` | 🔧 | Tooling/Config |
| `ci` | 🚀 | CI/CD |
| `revert` | ⏪️ | Revert changes |

---
*Follow the atomic commit principle: one commit per logical change.*
