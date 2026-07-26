# Commit Changes

You are committing code changes for the BBL Bookmark Manager project.
Follow these steps exactly.

## Step 1: Gather context

Run these commands in parallel:
- `git status` — see all changed/untracked files
- `git diff --stat` — see summary of staged + unstaged changes
- `git diff` — see the actual changes (staged + unstaged)
- `git log --oneline -5` — see recent commit style

## Step 2: Reference decisions (if relevant)

If this commit relates to a decision documented in DECISIONS.md,
reference it briefly in the commit body (e.g., "per DECISIONS.md
Token Choice", "per DECISIONS.md Collection Sharing").

No external task tracker is used in this project — skip any task ID.

## Step 3: Stage files

- Stage only the files relevant to this logical change
- NEVER stage `.env.local`, `.env`, credentials, or secrets
- Prefer specific files over `git add -A`
- If there are unrelated changes, ask the user which files to include

## Step 4: Write commit message

Follow this format EXACTLY:

```
type(scope): short description

Optional body — explain WHY, not what. Wrap at 72 chars.
Reference DECISIONS.md section if applicable.

Co-Authored-By: Claude <co-author>
```

### Types
- `feat` — new feature or capability
- `fix` — bug fix (especially: bug introduced by agent and caught in review)
- `refactor` — code restructuring, no behavior change
- `test` — adding or updating tests
- `docs` — documentation only
- `chore` — tooling, deps, config, CI

### Scopes (required)
- `backend` — NestJS API server
- `frontend` — React/Vite website
- `auth` — Auth0/OIDC integration, token validation, guards
- `prisma` — schema, migrations, seed data
- `docs` — DECISIONS.md, API_DESIGN.md, AI_WORKFLOW.md, README.md
- `agent` — CLAUDE.md, .claude/ configs
- `ci` — CI/CD pipeline (if implemented)
- `deps` — dependency updates

### Rules
1. Subject line max 50 chars
2. Imperative mood: "add" not "added"
3. Lowercase after colon
4. No period at end of subject
5. Body separated by blank line, explains motivation
6. One logical change per commit

## Step 5: Show and confirm

Show the user:
- Files to be staged
- The proposed commit message

Ask: "Commit with this message? (yes/edit/cancel)"

- **yes** — proceed with commit
- **edit** — user provides corrections, adjust and re-confirm
- **cancel** — abort, unstage files

## Step 6: Commit

Use a heredoc to preserve formatting:

```bash
git commit -m "$(cat <<'EOF'
type(scope): description

Body text here.

Co-Authored-By: Claude <co-author>
EOF
)"
```

## Step 7: Confirm

After successful commit, show:
- Commit hash (short)
- Branch name
- Reminder: `git push` when ready

Do NOT push automatically — the user decides when to push.