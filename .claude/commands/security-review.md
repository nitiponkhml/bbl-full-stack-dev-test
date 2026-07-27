# Security Review (BBL Bookmark Manager)

`.claude/agents/security-reviewer.md` defines a project-specific
subagent persona, but this environment's `Agent` tool does not source
custom types from `.claude/agents/*.md` — only a fixed set of built-in
agent types is available (`claude`, `claude-code-guide`, `Explore`,
`general-purpose`, `Plan`, `statusline-setup`). Calling
`subagent_type: "security-reviewer"` fails with `Agent type
'security-reviewer' not found.` This command is the standing fix:
it runs the exact same review through `general-purpose` instead of
recreating the workaround from memory each time.

## Steps

1. Read `.claude/agents/security-reviewer.md` in full.

2. Determine the review scope:
   - If invoked with an argument (a task name, file list, or PR/diff
     reference), use that.
   - Otherwise, run `git status` and `git diff --stat` to find
     uncommitted changes, and scope the review to files touching auth
     guards, routes, or database queries (per `CLAUDE.md`'s
     pre-commit rule). If nothing uncommitted matches, ask the user
     which files/commits to review rather than guessing.

3. Call the `Agent` tool with `subagent_type: general-purpose`. Build
   the prompt in two parts:
   - **Verbatim**: the persona, the 5-item checklist, and the output
     format from `.claude/agents/security-reviewer.md` — copied
     exactly, not paraphrased or summarized.
   - **Scope-specific context appended after it**: the concrete file
     paths in scope, which files (if any) were already reviewed and
     passed in a prior pass (so the agent doesn't re-review them from
     scratch, just uses them as context for cross-file checks like JWT
     validation or Bearer token type), and any project-specific detail
     needed to judge the diff correctly (e.g. what a given log line is
     supposed to contain/exclude).

4. Present the returned findings to the user in the exact format
   `security-reviewer.md` specifies (file path → PASS/FAIL/N/A per
   check → reasoning) — do not summarize away FAIL/CRITICAL findings.

5. If there are CRITICAL/FAIL findings, fix them before proceeding to
   commit; re-run this command against the fixed files to confirm.
