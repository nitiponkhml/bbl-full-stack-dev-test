# AI_WORKFLOW.md

## Tools and models used

- **Claude (claude.ai, Sonnet 5)**: Used for conceptual understanding
  (OIDC/PKCE/JWT mechanics), trade-off analysis (Bearer token choice),
  and drafting documentation (DECISIONS.md, API_DESIGN.md, CLAUDE.md
  drafts). No repo access — all repo changes were reviewed and applied
  via Claude Code.
- **Claude Code**: Used for all repo operations — scaffolding, file
  creation, git commits, and (upcoming) backend/frontend implementation.
- **Postman**: Manual verification tool — inspected Auth0 discovery
  document and JWKS, exchanged authorization codes for tokens (not an
  AI tool, but part of the verification workflow alongside AI usage).
- **jwt.io / Python**: Used to decode and compare JWT payloads across
  3 separate login sessions to verify claim stability empirically.

## How the work was decomposed

## Where AI did well

### 1. Catching empty-folder git tracking issue
- **What happened**: When scaffolding the repo structure, Claude Code
  noticed empty folders (backend, frontend, transcripts,
  .claude/commands) wouldn't be tracked by git and proactively asked
  how I wanted to handle it (offering .gitkeep as the recommended fix)
  instead of silently leaving them untracked.
- **Why it mattered**: Prevented a scenario where the folder structure
  looked complete locally but would be incomplete once pushed —
  caught before it became a problem.

### 2. Auth0 JWKS/discovery verification workflow
- **What happened**: Claude (claude.ai) guided a structured manual
  verification process (discovery doc → JWKS → 3 real logins → decode
  and compare tokens) rather than just asserting which token type to
  use.
- **Why it mattered**: Produced empirical evidence (real decoded
  tokens) backing the Bearer token decision, instead of a
  recommendation based on spec-reading alone.

### 3. Tracing a plugin dependency down to its real root, not the first fix
- **What happened**: I asked Claude Code to vendor two Claude Code
  plugins (`ui-ux-pro-max`, `superpowers`) into the repo so the
  project wouldn't depend on my personal PC's global `~/.claude`
  install. Claude Code's first fix — enabling the plugins via
  `.claude/settings.json` `enabledPlugins` — was still a global
  dependency, which I caught and corrected it on. Its second fix —
  copying the relevant skill files into `.claude/skills/` and
  clearing `enabledPlugins` back to `{}` — looked complete by every
  check available at the time (file listing, settings.json content).
  When I asked it to double-check after a reload, it didn't just
  re-assert the same conclusion: it noticed the plugin-namespaced
  skills (`ui-ux-pro-max:*`) were still active in the live skill
  list, traced that back through `/reload-plugins` output, and found
  a separate global state file
  (`~/.claude/plugins/installed_plugins.json`) that tracks per-project
  plugin installs independently of `settings.json` and wasn't touched
  by either prior fix. It declined to edit that file directly (live
  app state outside the repo) and instead had me run
  `/plugin uninstall`, then re-verified the live skill list was clean.
- **Why it mattered**: Two consecutive "this is fixed" claims were
  each only partially true. The gap wasn't caught by re-reading files
  or restating settings.json — it required checking the actual live
  skill list against what the fix should have produced, and being
  willing to say "not fully resolved yet" instead of declaring victory
  on a plausible-looking file state.

### 4. Diagnosing a subagent invocation failure instead of guessing
- **What happened**: `.claude/agents/security-reviewer.md` defines a
  project-specific subagent, referenced by name in `CLAUDE.md`'s
  finishing-up rule. Invoking it by `subagent_type: "security-reviewer"`
  failed: "Agent type 'security-reviewer' not found." I first asked
  Claude Code to restart the session in case this was a load-timing
  issue — the error persisted identically. I then asked Claude
  (claude.ai) for additional guidance; it researched the error and
  identified this as a known, documented limitation: custom subagents
  in `.claude/agents/` work via the Claude Code CLI but are not
  resolvable as `subagent_type` values specifically in the **VS Code
  extension's** Agent tool, which only recognizes a hardcoded set of
  built-in types — confirmed by multiple public bug reports with the
  identical error signature, including cases affecting official
  Anthropic-authored plugins in the same environment.
- **Why it mattered**: Rather than silently falling back or declaring
  the review "done" via some substitute, Claude Code ran the exact
  same persona/checklist/output format from `security-reviewer.md`
  verbatim through the `general-purpose` agent as a transparent
  workaround — confirmed (when I asked it to explain, for the
  Collections CRUD review) to genuinely read the real project files
  via its own file tools, not summarize from memory. The root cause
  was pinned down to a specific, externally-documented tool limitation
  rather than left as a guess, and the workaround was verified to
  preserve the same review rigor rather than assumed to.

## Where AI got it wrong

### 1. Docker base image version
- **What happened**: claude.ai suggested `node:20-alpine` as the base
  image for both Dockerfiles.
- **How I caught it**: Asked why not a newer version instead of
  accepting the default — prompted a verification check.
- **Finding**: Node 20 had already reached EOL (April 2026).
- **Fix**: Corrected to `node:24-alpine` (Active LTS as of July 2026).

### 2. API_DESIGN.md completeness
- **What happened**: claude.ai's first draft of API_DESIGN.md omitted
  filter support for `/collections` and had no status codes table.
- **How I caught it**: Re-checked the draft line-by-line against
  §3.1/§5 instead of accepting it as complete.
- **Finding**: Brief requires filtering on *both* resources (§3.1);
  §5 requires a status codes table — both missing from the draft.
- **Fix**: Added `?name=` filter to `/collections` and a full status
  codes table (200/201/204/400/401/404).

### 3. Imprecise "mostly PASS" summary of a security review
- **What happened**: After running the security review, Claude Code
  summarized one section as "Check 5 (error responses) + file-level
  audit — mostly PASS." This conflated two different things: Check 5
  itself was graded N/A on every file (no error-handling code exists
  yet to grade), while a separate, ad-hoc "file-level audit" (secret
  handling, Dockerfile hardening, dependency check — not part of the
  official 5-point checklist) had 3 PASSes and 1 FAIL (Dockerfile
  missing `USER node`). Averaging an N/A category together with a
  distinct PASS/FAIL category as "mostly PASS" wasn't accurate to
  either one.
- **How I caught it**: Asked "why mostly PASS for Check 5" instead of
  accepting the summary at face value.
- **Finding**: Check 5 should have been reported as N/A (not gradable
  yet), and the supplemental file audit reported on its own terms
  (3 PASS, 1 FAIL), rather than blended into one vague label.
- **Fix**: Claude Code re-stated the finding split cleanly: Check 5 —
  N/A across the board; file-level audit — 3 PASS, 1 FAIL (Dockerfile
  root user).

## Prompts — one that worked, one that needed correction

**Worked**:
"don't commit yet, I want to see how many table, and each table
structure"

This stopped the workflow at exactly the right point — after the
Prisma migration was applied but before it was committed — and asked
for a concrete, verifiable artifact (the actual tables/columns in the
live database) instead of accepting a prose summary of
`schema.prisma`. It forced a real `psql \dt` / `\d` query against the
running Postgres container, so what got confirmed was the database's
actual state, not the source file's stated intent — those can differ
if a migration only partially applies or an old container is still
running stale state.

**Why it mattered**: matches the same empirical-over-asserted pattern
as the `sub` claim verification in DECISIONS.md — checking that the
migration file *says* the right thing is necessary but not sufficient
proof that the database *has* the right thing.

**Needed correction**:
"is it possible to move superpower and ui ux pro max into project?"

This was ambiguous between two different meanings of "move into
project": (a) scope/enable the plugin for this project via
`.claude/settings.json` (still depends on the global `~/.claude` plugin
cache to resolve), or (b) copy the actual skill files into the repo so
it's fully standalone. Claude Code took the first reading — updating
`enabledPlugins`/`extraKnownMarketplaces` — which looked done but still
depended on my machine's global install.

**Fix**:
"what I told you before I mean also move file in not using from global in my PC"

This worked because it named the concrete artifact ("file", not
"plugin enabled") and explicitly ruled out the global-dependency
reading ("not using from global in my PC"). Claude Code then vendored
the actual skill files into `.claude/skills/`, added proper MIT
attribution (THIRD_PARTY_NOTICES.md), and reverted settings.json to `{}`.

**Lesson**: "Move X into the project" is ambiguous between
config-level scoping and physically relocating files — for tooling
that supports both a reference-based and a vendored mode, name which
one explicitly.

## Cost/token awareness