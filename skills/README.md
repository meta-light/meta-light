# skills

Source of truth for agent skills. Each skill is a directory with a `SKILL.md`; edit them here, never in `.claude/skills` or `.agents/skills`.

`sync.sh` symlinks every skill into the dirs agents read:

```sh
bun run skills:sync              # .claude/skills and .agents/skills in this repo
bun run skills:sync -- --global  # also ~/.agents/skills, ~/.claude/skills, ~/.codex/skills
bun run skills:sync -- --dry-run # show what would change
```

Run it after adding, renaming or deleting a skill. Edits to an existing skill are live through the link.

- An existing entry that is not a link to this directory (a real dir, or someone else's link) is skipped and reported, never overwritten.
- Links into this directory whose skill no longer exists are removed.
- Repo links are relative and committed, so a fresh clone works without running the script.
