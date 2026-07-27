# CLAUDE.md — Agent Rules for BBL Bookmark Manager

## Project context
Personal bookmark manager (private read-later app) for Bangkok Bank's
full-stack candidate test. Core invariant: a user must never see, edit,
or learn of the existence of another user's data.

Tech stack (mandatory, do not substitute):
- Backend: Node.js + TypeScript + NestJS + Prisma + PostgreSQL
- Frontend: React + Vite + TypeScript (no Next.js) + React Router v8+ + MUI v9+
- Auth: Auth0 OIDC, Authorization Code + PKCE (S256) only — no implicit flow
- Bearer credential: Access Token (RS256) — see DECISIONS.md for rationale

## Before starting any task
- List all tools/skills/subagents you plan to use and get my explicit OK
  before starting.
- Scope work to this repo's docs (API_DESIGN.md, DECISIONS.md) — don't
  invent requirements that aren't written there.
- If a requirement is ambiguous (e.g. the collection-sharing spec), ask
  once, then document the decision in DECISIONS.md rather than guessing
  silently.

## During work
- Every protected route must validate the Access Token via JWKS
  (check `iss`, `aud`, `exp`, and signature using the key matching the
  JWT's `kid`).
- Every DB query scoped to a user must filter by `ownerId` derived from
  the token's `sub` claim — never trust a client-supplied user identifier
  from the request body or query params.
- Follow TDD for security-sensitive logic (auth guard, ownership checks):
  write a failing test first, then implement.
- Never run the dev server yourself — I will run it and report back.
- Backend must have CORS enabled for the frontend's origin
  (http://localhost:3000, or wherever the Vite dev server runs) before
  frontend integration testing begins.

## Frontend rules
- ID Token (decoded client-side) is used only for displaying user
  info in the UI (name, email, picture) — never sent to the backend.
- Access Token is the only credential sent to the backend, as
  `Authorization: Bearer <token>` — matches the backend's Bearer
  Token Type decision in DECISIONS.md.
- Token storage: `sessionStorage` — see DECISIONS.md ("Token storage
  location") for the reasoning and known trade-off (readable by
  page scripts, not XSS-proof; chosen over an httpOnly cookie given
  time constraints).
- Routing: `/` is a landing/decision point (redirects to /collections
  if a valid token exists, otherwise shows a "Sign in" button) —
  not counted as a third required page. `/callback` handles the
  Authorization Code + PKCE exchange. `/collections` and `/bookmarks`
  are the two required pages (§3.2), both wrapped in route protection
  that redirects unauthenticated access back to `/`.
- Logout: clears stored token(s) client-side and redirects to Auth0's
  logout endpoint (per the tenant's configured Logout URL:
  http://localhost:3000) to also end the Auth0 session.

## Finishing up
- After implementing a feature, summarize what changed and wait for my
  approval before committing.
- Never mark a requirement "done" without a runnable test proving it.
- Before committing any change to backend auth guards, routes, or
  database queries, run the security-reviewer subagent
  (.claude/agents/security-reviewer.md) and show me the results.
- Use the `/commit` command (see .claude/commands/commit.md) for all commits.
- After work is done, state my confidence level as a percentage (e.g.
  90%) and why — call out what's actually verified (tests passing,
  manual checks) vs. what's assumed or untested, so confidence isn't
  just a feeling.

## Documenting decisions and AI usage
- When a new decision, ambiguity resolution, or notable AI-usage
  situation comes up during work, draft the entry directly into
  DECISIONS.md or AI_WORKFLOW.md (matching the existing format in
  each file) rather than only mentioning it in chat.
- Present the drafted entry for review before it's considered final —
  same approval gate as code changes. Do not commit it silently.
- DECISIONS.md entries: each starts with `## Decision: <title>`,
  ADR-style, `---`-separated, using **Context/Decision**, **Reasoning**
  (or **What I did**), and **Verification method/Outcome** as applicable.
- AI_WORKFLOW.md entries: fit into the existing section structure
  (Tools and models used / How the work was decomposed / Where AI did
  well / Where AI got it wrong / Prompts / Cost/token awareness) —
  don't invent new top-level sections without asking.

## Git workflow
- Commit in small, meaningful steps — one logical change per commit.
- Never squash commits.
- Do not push automatically — I decide when to push.
- Never commit .env, .env.local, real JWTs, or any credential value —
  even inside transcripts or documentation. Redact before committing.