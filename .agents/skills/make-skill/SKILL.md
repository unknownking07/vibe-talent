---
name: make-skill
description: Turn any workflow into a properly structured Claude Code skill — YAML frontmatter, phase-based instructions, real code blocks, and a verify checklist. Use when the user wants to package a repeated workflow, create a new skill, turn a process into a slash command, or publish to the skills directory. Triggers on requests like "make a skill", "create a skill", "turn this into a skill", "new skill for...", "package this as a skill", "build a skill", "I want to publish a skill", "help me write a skill", or any request to create a reusable Claude Code skill.
category: meta
tags: [skills, automation, workflow, meta, claude-code]
author: tushaarmehtaa
---

Package any workflow into a Claude Code skill. The output is a SKILL.md ready to publish with `/publish-skill`.

## Phase 1: Capture the Workflow

Ask for anything missing:

1. **What does it do?** — One sentence. What problem does it solve?
2. **When should it trigger?** — Exact phrases or contexts. Be specific.
3. **What does it need from the user?** — Inputs before it can run.
4. **What does it output?** — File changes, code, chat output, commands?
5. **What are the steps?** — Walk through the process start to finish.
6. **What are the hard rules?** — Things it must always or never do.

If the current conversation already describes a workflow, extract answers from it before asking. Don't ask for what you already have.

## Phase 2: Write the Frontmatter

```yaml
---
name: skill-name           # lowercase, hyphenated, no spaces
description: [What it does]. Use when [contexts]. Triggers on requests like "[exact phrase]", "[exact phrase]", "[exact phrase]", or any request for [broader category].
category: [devops|ai|analytics|auth|payments|seo|marketing|planning|meta|workflow]
tags: [tag1, tag2, tag3]   # 3-5 lowercase keywords
author: tushaarmehtaa
---
```

**The description is the trigger.** Claude uses it to decide when to activate the skill. Make it explicit:

- Include WHAT the skill does AND WHEN to use it
- List specific trigger phrases in quotes — exact words a user would type
- End with a broader catch-all pattern
- Over-specify rather than under-specify — Claude tends to undertrigger

## Phase 3: Write the Body

The structure that matches the quality bar of the existing skills:

```
[One-liner opener — what this does, what it outputs. No heading above this.]

## Phase 1: [First Phase Title]

[Instructions. Dense. Opinionated. No hedging.]

## Phase 2: [Next Phase Title]

...

## Verify

```
[ ] [Thing that must be true]
[ ] [Thing that must be true]
[ ] [Edge case handled]
```
```

**Rules that don't move:**

- Open with a single sentence — no `# Heading` before it. This is the first thing Claude reads.
- Use `## Phase N: Title` for every major section
- Use `### 1.1` sub-phases only when Phase 1 needs branching (stack detection, mode selection)
- Code blocks must contain real, runnable code — not pseudocode
- **Bold warnings inline** for things that fail silently or break the whole flow
- End with `## Verify` using bare `[ ]` items inside a code block (not markdown `- [ ]` list items)
- Under 500 lines total — push long examples to `references/guide.md`

## Phase 4: The Verify Section

The verify section is not optional. It's how the user confirms the skill ran correctly.

Format exactly like this — bare brackets in a fenced code block:

````markdown
## Verify

```
[ ] [Thing that must be true after the skill runs]
[ ] [Output format is correct]
[ ] [Edge case handled]
[ ] [Common mistake avoided]
```
````

Each item must be checkable — either it's done or it isn't. No vague items like "quality looks good."

## Phase 5: References (if needed)

Create `references/guide.md` when:

- Full examples would push SKILL.md over 500 lines
- Multiple variants need their own section
- Edge cases are complex enough to need real examples

The reference file must have real input → output examples. Not outlines of examples.

## Phase 6: Test Prompts

Write 3–5 prompts that should trigger the skill, and 2 that should NOT:

```
"make a skill for PR reviews"          ✅ should trigger
"create a skill to audit my code"      ✅ should trigger
"turn this process into a skill"       ✅ should trigger
"review my PR"                         ❌ should not trigger (different skill)
"what skills are available?"           ❌ should not trigger
```

Use these to validate the description before publishing. If any trigger should fire but doesn't, add the phrase to the description.

## Phase 7: Publish

Use `/publish-skill` to copy the skill into the repo, update the README, build the site, and push.

## Verify

```
[ ] YAML frontmatter has all 5 fields (name, description, category, tags, author)
[ ] Description includes specific trigger phrases in quotes
[ ] Body opens with a one-liner — no heading before it
[ ] All sections use ## Phase N: Title format
[ ] Code blocks contain real code, not pseudocode
[ ] Critical constraints are bolded inline
[ ] Verify section uses bare [ ] items in a fenced code block
[ ] SKILL.md is under 500 lines
[ ] Long examples moved to references/guide.md if needed
[ ] 3-5 test prompts written to validate triggers
```

See [references/guide.md](references/guide.md) for full annotated SKILL.md examples, common structural mistakes, and the complete list of valid categories.
