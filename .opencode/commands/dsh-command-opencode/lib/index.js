/**
 * dsh-command-opencode
 *
 * Reusable DSH plugin that reads .opencode/commands/*.md files from the current
 * workspace and registers each one as a DSH slash command with an "oc-" prefix
 * (e.g. /oc-spec, /oc-plan, /oc-implement).
 *
 * How it works:
 *   - On activation, scans the workspace's .opencode/commands/ directory.
 *   - For each *.md file, parses its YAML frontmatter (description) and body.
 *   - Registers a slash command `oc-<basename>` whose handler loads the
 *     referenced DSH skill(s), replaces $ARGUMENTS with user input, and injects
 *     the result into the agent's next turn.
 *   - Also registers an `/oc-help` command listing all available oc-* commands.
 *   - Each handler re-reads the file at invocation time so edits take effect
 *     immediately; new files require a plugin restart (cordis_run update).
 *
 * Compatible with any project that follows the OpenCode .opencode/commands/
 * convention.
 *
 * @module dsh-command-opencode
 */

var name = 'command-opencode'
var inject = ['commands', 'fs', 'skills', 'agents']

var FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/
var SKILL_REF_RE = /`([a-z0-9]+(?:-[a-z0-9]+)*)`/g
var CMD_NAME_RE = /^[a-z][a-z0-9-]*$/

function parseCommandFile(text) {
  var match = text.match(FRONTMATTER_RE)
  if (!match) return undefined
  var frontmatter = match[1]
  var body = match[2].trim()
  var descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m)
  var description = descriptionMatch ? descriptionMatch[1].trim() : ''
  if (!description) return undefined
  return { description: description, body: body }
}

function extractSkillNames(body) {
  var names = []
  var match
  var re = new RegExp(SKILL_REF_RE.source, 'g')
  while ((match = re.exec(body)) !== null) {
    if (!names.includes(match[1])) names.push(match[1])
  }
  return names
}

function expectsImages(body) {
  return /\$IMAGES\b/.test(body)
}

function expectsArguments(body) {
  return /\$ARGUMENTS\b/.test(body)
}

function renderBody(body, args) {
  return body.replace(/\$ARGUMENTS/g, args).trim()
}

function injectSkillWorkflow(agent, instruction, skills) {
  var blocks = []
  for (var i = 0; i < skills.length; i++) {
    blocks.push({
      type: 'text',
      text: '<skill_content name="' + skills[i].name + '">\n' + skills[i].content + '\n</skill_content>',
    })
  }
  if (instruction) {
    blocks.push({
      type: 'text',
      text: instruction,
    })
  }
  if (blocks.length === 0) return
  agent.followup({
    role: 'user',
    content: blocks,
    source: { kind: 'user' },
  })
}

function skillLookup(agent, signal) {
  return {
    cwd: agent.session.header.cwd,
    signal: signal,
    scope: agent,
  }
}

async function readCommandFile(ctx, filePath, signal) {
  var fileKey
  try {
    fileKey = await ctx.fs.resolve(filePath)
  } catch (_err) {
    return undefined
  }
  var text
  try {
    text = await ctx.fs.readText(fileKey, signal)
  } catch (_err) {
    return undefined
  }
  return parseCommandFile(text)
}

async function handleCommand(invocation, ctx, commandsDir, fileName) {
  var rawInput = invocation.rawInput.trim()
  var filePath = commandsDir + '/' + fileName
  var cmdName = fileName.slice(0, -3)

  var parsed = await readCommandFile(ctx, filePath, invocation.signal)
  if (!parsed) {
    return { kind: 'error', text: 'Could not read command file: ' + fileName }
  }

  var hasArgs = expectsArguments(parsed.body)
  if (hasArgs && rawInput.length === 0) {
    return { kind: 'error', text: 'Usage: /oc-' + cmdName + ' <arguments>' }
  }

  var hasImages = expectsImages(parsed.body)
  if (invocation.attachments.length > 0 && !hasImages) {
    return { kind: 'error', text: 'This command does not accept image attachments.' }
  }

  var skillNames = extractSkillNames(parsed.body)
  var loaded = []
  var lookup = skillLookup(invocation.agent, invocation.signal)

  for (var i = 0; i < skillNames.length; i++) {
    var skillName = skillNames[i]
    try {
      var skill = await ctx.skills.get(skillName, lookup)
      if (skill) {
        loaded.push({ name: skill.name, content: skill.content })
      } else {
        return { kind: 'error', text: 'Command references skill "' + skillName + '" which is not available in this session.' }
      }
    } catch (_err) {
      return { kind: 'error', text: 'Could not load skill "' + skillName + '": ' + (_err instanceof Error ? _err.message : String(_err)) }
    }
  }

  var instruction = renderBody(parsed.body, rawInput)
  injectSkillWorkflow(invocation.agent, instruction, loaded)

  return { kind: 'success', text: 'Loaded ' + loaded.length + ' skill(s) for /oc-' + cmdName + '.' }
}

async function apply(ctx) {
  var agents = ctx.agents.list()
  var agent = agents.length > 0 ? agents[0] : undefined
  var cwd = agent ? agent.session.header.cwd : process.cwd()
  var commandsDir = cwd + '/.opencode/commands'

  var dirKey
  try {
    dirKey = await ctx.fs.resolve(commandsDir)
  } catch (_err) {
    return
  }

  var dirInfo
  try {
    dirInfo = await ctx.fs.stat(dirKey)
  } catch (_err) {
    return
  }
  if (!dirInfo || !dirInfo.isDirectory) return

  var files
  try {
    files = await ctx.fs.listDir(dirKey)
  } catch (_err) {
    return
  }

  var discovered = []

  for (var i = 0; i < files.length; i++) {
    var entry = files[i]
    if (!entry.name.endsWith('.md')) continue

    var cmdName = entry.name.slice(0, -3)
    if (!CMD_NAME_RE.test(cmdName)) continue

    var parsed = await readCommandFile(ctx, commandsDir + '/' + entry.name)
    if (!parsed) continue

    discovered.push({
      name: cmdName,
      description: parsed.description,
    })

    ctx.commands.register({
      name: 'oc-' + cmdName,
      description: parsed.description,
      input: (function (body) {
        var hint = expectsArguments(body) ? '<text>' : undefined
        var images = expectsImages(body) || undefined
        return hint || images ? { hint: hint, images: images } : undefined
      })(parsed.body),
      handler: (function (fn) {
        return function (invocation) {
          return handleCommand(invocation, ctx, commandsDir, fn)
        }
      })(entry.name),
    })
  }

  if (discovered.length > 0) {
    ctx.commands.register({
      name: 'oc-help',
      description: 'List available OpenCode workflow commands',
      handler: function (_invocation) {
        var lines = []
        for (var j = 0; j < discovered.length; j++) {
          lines.push('/oc-' + discovered[j].name + ' \u2014 ' + discovered[j].description)
        }
        return {
          kind: 'success',
          text: 'Available OpenCode commands:\n\n' + lines.join('\n'),
        }
      },
    })
  }
}

export default { apply, inject, name }