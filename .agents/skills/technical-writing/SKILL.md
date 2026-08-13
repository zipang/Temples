---
name: technical-writing
description: Write/review/update technical prose (docs, READMEs, skills, agents instructions, PR descriptions, code comments and JSDoc — never code) into Simplified Technical English (STE) to remove ambiguities. Use the skill when asked to enforce a controlled writing style, e.g. "apply STE", "clarify these docs", "write technical documentation for topic".
---

# Skill purpose and usage

Write prose in ASD-STE100 Simplified Technical English (STE). Use it for the technical prose in the DO list only. STE applies to full sentences, never to the tokens inside them.

**DO — use the skill for:**
- Technical documentation, guides, and README files
- Agent skills and agent instructions (SKILL.md, AGENTS.md, agent definitions)
- Pull-request descriptions
- Commit messages
- Release notes
- Error messages
- Code comments and JSDoc

**DON'T — use it for anything else. The only ambiguous cases:**
- Text inside code: identifiers, shell commands, and markup always stay verbatim. STE applies to the sentences around them, not to the tokens.
- Text that needs a voice: marketing copy, UI copy, essays, fiction, poetry. STE strips voice on purpose.
- Conversation or chat.

## Rules

WORDS
- Use one name for one thing. Do not call the same item by two different names.
- Use the short common word: start (not begin/commence/initiate), use (not utilize/leverage), help (not facilitate), make sure (not ensure), before (not prior to), after (not subsequent to), about (not regarding/concerning), get (not obtain/acquire), show (not demonstrate), also (not additionally/furthermore/moreover).
- Give each word one meaning. "fall" means to move down, not to decrease.
- No marketing adjectives: seamless, robust, powerful, cutting-edge, effortless, world-class, next-generation, revolutionary.
- American spelling.

VERBS
- Active voice. "the parser reads the file", not "the file is read by the parser".
- Use a verb for an action. "analyze the log", not "perform an analysis of the log".
- No stacked auxiliaries. Not "it is important to note that this may help to improve". Write "this improves X".
- No "-ing" main verb where a simple tense works.

SENTENCES
- One instruction per sentence. Max 20 words (instruction), max 25 (descriptive).
- No contractions. Use articles: a, an, the, this, these.

PUNCTUATION
- No semicolons. Write two sentences. (Note: the em dash is not banned by STE, only the semicolon is — add "no em dash" yourself if you want it gone.)

STRUCTURE
- One topic per paragraph, max six sentences. For steps, use a numbered vertical list, one action per item, imperative form. Put a condition before its command.

Write only the requested text. No preamble, no summary, no closing remarks.

## Modes

- **strict** — procedures, runbooks, safety text, error messages: apply every rule and both length caps.
- **STE-flavored** — general prose (READMEs, PR descriptions, docs): apply the sentence, paragraph, active-voice, and no-phrasal-verb discipline; relax the ~900-word dictionary lockdown so the text keeps enough range to read naturally.

## Self-lint (run before returning text)

1. Any sentence over 20 words? Split it.
2. Any semicolon? Replace with a period.
3. Any contraction? Expand it.
4. Any passive voice with a known actor? Make it active.
5. Any "-ing" main verb, nominalization ("perform an analysis"), or phrasal verb ("spin up")? Replace with a plain verb.
6. Same thing named two ways? Pick one name.

The mechanical rules above are lintable and are what removes slop. Full STE also needs human judgment (the right technical noun, whether a sentence "makes good sense") — a checker cannot certify that, and slop is not about that. This skill fixes the FORM of slop. It cannot make a hollow paragraph true.

Free official standard (do not paste it in full; it is copyrighted): https://asd-ste100.org