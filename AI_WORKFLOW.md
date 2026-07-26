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

## Prompts — one that worked, one that needed correction

**Worked**:

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