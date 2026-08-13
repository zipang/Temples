---
name: git-commit
description: Create well-formatted commits with conventional commit messages and emoji. Use when the user asks to commit changes, run the /commit command, or says "commit my changes". Each commit is atomic and uses a conventional message (<emoji> <type>: <description>). Confirms every commit with the question tool before executing.
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
     - If the arguments are ambiguous or missing, identify logical groups of changes.
     - Use the `question` tool to let the user select the group to stage and commit.
     - **NEVER** run `git add .` automatically if multiple unrelated changes exist.
   - If files are already staged, proceed with only those files.

3. **Analyze the changes**:
   - Run `git diff --cached` to see what will be committed.
   - Determine the primary change type (feat, fix, docs, etc.) and scope.

4. **Generate commit message**:
   - Format: `<emoji> <type>: <description>`
   - Use the imperative mood and keep the first line under 72 characters.

5. **Confirm the commit with the `question` tool**:
   - Always confirm a commit with the `question` tool. Never use a text prompt.
   - Set the question to `Commit <file list> with the following message:`.
   - Set the first option to the proposed message. This option is the default. The user confirms it with the ENTER key.
   - Do not add a custom option. The tool adds a `Type your own answer` option automatically. The user types their own message there.
   - Give every option a `description` field. The tool schema requires it.

   Example :

   ```json
   {
     "questions": [
       {
         "header": "Commit confirmation",
         "question": "Commit README.md, tasks/plan.md, tasks/todo.md with the following message:",
         "options": [
           {
             "label": "(default) 📝 docs: revise plan around standalone engine and SSR entry",
             "description": "Confirm the commit with the proposed message."
           }
         ]
       }
     ]
   }
   ```

   - If the user confirms the default option, run the commit as proposed.
   - If the user types their own message, use it as the commit message, then run the commit.

6. **Execute the commit**:
   - **ONLY** after the `question` tool confirms the commit, run `git commit -m "<message>"`.
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
