# DECISIONS.md

ADR-style log of decisions made where the brief's spec was silent or
ambiguous, and how AI tooling was steered toward each decision.

---

## Decision: Use of claude.ai during Phase 0 (pre-implementation research)

**Context**: Before writing any code, I needed to understand OIDC/PKCE
mechanics, Auth0 tenant capabilities, and evaluate the Bearer token
trade-off (Access Token vs ID Token) that the brief deliberately left
undecided.

**What I did**:
- Used Claude (claude.ai) — not an agentic coding session, no repo
  access — as a conceptual research and reasoning partner to understand:
  - OIDC discovery documents and JWKS (what they are, why they exist)
  - PKCE flow mechanics (code_verifier / code_challenge / S256)
  - JWT structure (header / payload / signature) and claim semantics
    (sub, aud, iss, azp)
  - Trade-offs between Access Token and ID Token as a Bearer credential
- All verification was done manually by me, not delegated to AI:
  - Inspected the Auth0 discovery document
    (/.well-known/openid-configuration) via Postman
  - Inspected JWKS (/.well-known/jwks.json) via Postman
  - Logged in manually 3 separate times via browser (Authorization
    Code + PKCE flow, constructed by hand) using the provided test user
  - Exchanged authorization codes for tokens via Postman
  - Decoded both Access Token and ID Token payloads/headers myself
    (Python one-liner) to inspect real aud/sub/alg/kid values across
    all 3 login sessions

**Why disclosed this way**: The brief requires disclosing how AI was
used, not just that it was used. claude.ai was used for conceptual
understanding and trade-off analysis; it did not write any code, touch
the repo, or perform the verification steps — those were done by hand
against the real Auth0 tenant to ensure the evidence backing this
decision is empirical, not AI-asserted.

**Outcome**: See "Decision: Bearer Token Type" below — this research
and manual verification directly informed that decision.

---

## Decision: Verifying `sub` claim stability (not just trusting AI's claim)

**Context**: While analyzing the Access Token vs ID Token trade-off,
claude.ai pointed out that the `sub` claim should be stable across
logins (per OIDC spec) and could safely be used as the basis for
`ownerId`.

**What I did**: I did not accept this claim at face value. I manually
tested it by logging in 3 separate times via browser (constructing the
Authorization Code + PKCE flow by hand each time, generating a fresh
code_verifier/code_challenge pair per attempt), exchanging each
authorization code for tokens via Postman, and decoding the payloads
myself (Python one-liner) to compare the `sub` value across all 3
sessions.

**Result**: `sub` (`auth0|62e089faea483987422db6cc`) was identical
across all 3 logins, confirming it's safe to use as the `ownerId`
foreign key. This was verified empirically against the real tenant,
not assumed from AI's explanation or from reading the spec alone.

---

## Decision: Bearer Token Type

**Decision**: Access Token (RS256, JWT) — not ID Token.

**Reasoning**:
1. `aud` claim: Access Token's `aud` resolves to
   `https://bbl-candidate-test-api` (this backend's own identity,
   requested via the `audience` parameter). ID Token's `aud` resolves
   to the `client_id` (the frontend's identity) — meaning it is
   intended for the client to consume, not for a resource server to
   authorize against.
2. `sub` claim is present and identical in both tokens, and verified
   stable across 3 separate login sessions (see decision above). This
   means `ownerId` can be safely derived from the Access Token's `sub`
   claim without needing the ID Token at all.
3. The backend (list/get collections and bookmarks) does not need any
   PII — the ID Token's claims (email, name, picture) are irrelevant
   to authorization decisions and are reserved for frontend UI display
   only.
4. The discovery document lists `HS256` as a supported ID Token signing
   algorithm alongside `RS256`/`PS256`. Accepting ID Tokens as Bearer
   credentials would risk algorithm-confusion issues if a token were
   ever signed with the symmetric HS256 algorithm. Access Tokens
   requested with an explicit `audience` are issued as RS256 JWTs
   (verified empirically — see verification method below), avoiding
   this risk entirely.

**Verification method**: curl/Postman against the Auth0 discovery
document and JWKS endpoint; 3 separate manual logins via browser
(Authorization Code + PKCE flow); decoded and compared token payloads
across all 3 sessions. See /transcripts/ for the process.

---

## Decision: Agent config path — `.claude/` vs `/.agent/`

**Context**: The brief's suggested repo shape (§5) references a
generic `/.agent/` folder for reusable agent capabilities.

**Decision**: Used `.claude/commands/` instead, since this project uses
Claude Code specifically, and `.claude/` is its native convention for
custom slash commands.

**Reasoning**: The brief explicitly says the repo shape is "roughly
this shape" — not a literal path requirement — since different
candidates may use different agent tools (Claude Code, Codex, Copilot,
etc.), each with its own native config path. Using a real,
functioning `.claude/commands/commit.md` provides genuine agent
tooling (visible in every Claude Code session) rather than a
decorative folder that matches the brief's wording but has no actual
effect.

---

## Decision: Seed data for 2 users

**Context**: §3.1 requires seed data for at least 2 distinct users, but
the Auth0 test tenant provides only 1 real login-capable account
(candidate@test.com).

**Decision**: Seed a second user in the database with a synthetic
`ownerId` (a fabricated `sub`-like string, not tied to a real Auth0
login).

**Reasoning**: The requirement's purpose is to prove the privacy
invariant (a user must never see/edit/learn of another user's data) —
this only requires that data exists under a different `ownerId` in the
database, not that a second real login be possible. Automated tests
use the real user's token to verify the synthetic user's data is never
returned, exposed, or otherwise reachable.

---

## Decision: Node.js base image version for Docker

**Context**: Building Dockerfiles for backend and frontend (optional
bonus, §3.4).

**Decision**: `node:24-alpine` (Active LTS as of July 2026).

**Reasoning**: Node 24 is the current Active LTS line, receiving
security patches through April 2028. Node 20 — initially suggested by
claude.ai — reached end-of-life in April 2026 and is no longer safe to
use as a base image. See AI_WORKFLOW.md ("Where AI got it wrong") for
how this was caught.

---

## Decision: Frontend routing — landing page and auth entry point

**Context**: §3.2 specifies exactly two required pages (/collections,
/bookmarks) but doesn't mention how a user actually initiates login,
since the Auth0 Universal Login form itself is hosted by Auth0, not
built by this frontend. Without an entry point and a callback handler,
the OIDC flow has nowhere to start or land in the UI.

**Decision**:
- `/` — a landing/decision point (not counted as a third "page" per
  §3.2, since it has no application data or CRUD logic of its own).
  If a valid, non-expired Access Token is present, redirect straight
  to `/collections`. Otherwise, show a single "Sign in" button that
  starts the Authorization Code + PKCE flow.
- `/callback` — receives the authorization code from Auth0, exchanges
  it for tokens, then redirects to `/collections`.
- Both `/collections` and `/bookmarks` are wrapped in route protection:
  unauthenticated access redirects back to `/`.

**Reasoning**: This keeps the required page count at exactly 2 (per
§3.2) while still providing a working entry point for the OIDC flow.
Redirecting already-authenticated users straight to `/collections`
avoids forcing a login step on every visit, matching how the token
model (see "Bearer Token Type" above) is meant to work.

---

## Decision: Token storage location on the frontend

**Context**: The Access Token (and ID Token, used for UI display) need
to persist somewhere between page loads so a returning user with a
still-valid token isn't forced to log in again. Options considered:
in-memory (React state only), `localStorage`, `sessionStorage`, or an
httpOnly cookie set by the backend.

**Decision**: `sessionStorage`.

**Reasoning**: An httpOnly cookie is the strongest option against XSS
(JavaScript — including malicious injected script — cannot read the
token at all), but it requires the backend to perform the code
exchange and set the cookie itself, meaningfully changing the flow
already implemented (frontend currently exchanges the code directly
with Auth0). Given the time remaining, `sessionStorage` was chosen as
the practical trade-off: it persists across page reloads within a tab
(avoiding a re-login on every navigation) while clearing on tab close,
which is a smaller exposure window than `localStorage`. This is a
known trade-off, not an oversight — `sessionStorage` (like
`localStorage`) is still readable by any script running on the page,
so it does not protect against XSS the way an httpOnly cookie would.

---

## Decision: Collection sharing (§3.3)

**Context**: §3.3 says "A user may want to share a collection with
someone else" — phrased as a soft/optional desire, not a numbered hard
requirement, and stated immediately after the core invariant (§3): "a
user must never see, edit, or learn of the existence of another user's
data." Any sharing mechanism (named-user grants, share links, etc.)
necessarily creates a controlled exception to that invariant, which
changes it from absolute to conditional.

**Decision**: Not implemented. The `Collection` and `Bookmark` schemas
and all guard/query logic keep the invariant absolute — no cross-user
read/write path exists, by construction, not by a feature flag.

**Reasoning**:
1. The invariant is stated as the project's core, non-negotiable
   property. Introducing any sharing surface (even read-only) is a new
   trust boundary needing its own threat model, ownership-transfer
   semantics on delete, and test coverage — scope the brief doesn't ask
   for explicitly ("may want to", vs. a numbered requirement like the
   rest of §3).
2. Implementing a half-considered sharing feature under time pressure
   is a more likely source of a real privacy bug than declining to
   build it and documenting why.
3. If sharing were required, the two realistic designs are (a)
   named-user grants via a join table
   (`CollectionShare(collectionId, sharedWithOwnerId)`, read-only), or
   (b) an unguessable share-link token on `Collection` (identity-blind,
   read-only). Both are viable follow-ups; (b) fits this app's
   identity-blindness invariant more closely, since it never exposes
   one user's identity to another.

**Outcome**: No schema changes for sharing in this pass. Revisit only
if explicitly requested, with (b) as the preferred starting design.

---

## Decision: Auth guard success/failure logging — no claim/error detail in log lines

**Context**: After adding the `GET /me` endpoint, the request was to
add server-side visibility into whether requests were authenticating
or not (distinct from the response body, which already has a
regression test proving it never leaks `jwt`/`expired`/`signature`
details — see the auth guard's e2e tests).

**Decision**: `JwtAuthGuard.handleRequest()` logs exactly one of two
fixed strings — `"Auth success"` or `"Auth failed"` — with no
interpolated values: no `sub`, no token, no `err`/`info` reason, no
stack trace. The actual accept/reject decision is unchanged, still
delegated to `AuthGuard`'s default `handleRequest()` via `super.call`.

**Reasoning**:
1. The `sub` claim, while not a secret, is still a per-user identifier;
   logging it on every request unnecessarily widens what a log-access
   compromise could reconstruct (request timing correlated to a
   specific user).
2. `info`/`err` messages from `passport-jwt` (e.g. "jwt expired",
   "invalid signature") are useful for debugging but are the same class
   of internal detail already kept out of the HTTP response body — kept
   out of logs too, for consistency, since nothing about this task
   required them.
3. TDD (per CLAUDE.md's rule for auth-guard changes): the failing tests
   in `jwt-auth.guard.spec.ts` were written first, asserting
   `toHaveBeenCalledWith('Auth success')` / `('Auth failed')` with
   `toHaveBeenCalledTimes(1)` — this pins the "exact string, nothing
   else" contract so a future edit that adds an interpolated value
   would fail the suite, not just fail a manual review.

**Verification method**: Unit tests (`jwt-auth.guard.spec.ts`, 3 cases:
success, no-user failure, thrown-error failure) plus the full existing
e2e suite (`auth.e2e-spec.ts`, `me.e2e-spec.ts`) re-run to confirm no
regression in accept/reject behavior. Reviewed via the
security-reviewer checklist — no CRITICAL/FAIL findings, log-content
check confirmed line-by-line.

---

## Decision: Bookmark `collectionId` must reference the caller's own collection

**Context**: `Bookmark.collectionId` is an optional, client-suppliable
field (per `API_DESIGN.md`'s field table). `API_DESIGN.md` doesn't
explicitly say what happens if a client supplies a `collectionId` that
exists but belongs to a different owner, or doesn't exist at all.
Since no read path leaks data either way (every bookmark/collection
query is independently scoped by `ownerId`), this wasn't a privacy
leak either way — but it was still an open question of what the
correct behavior should be.

**Decision**: On both `POST /bookmarks` and `PUT`/`PATCH
/bookmarks/:id`, if `collectionId` is provided, the server validates
that a `Collection` with that `id` exists **and** is owned by the
caller (`ownerId` from the token). If not, the request is rejected
with `404 Not Found` (`"Collection not found"`) — the same treatment
as any other cross-owner or nonexistent resource reference in this
API, not a `400` and not silent acceptance.

**Reasoning**:
1. Consistency with the project's established pattern: every other
   cross-owner resource reference in this API (a `Collection` or
   `Bookmark` `:id` that exists but isn't yours) returns 404, never
   403 and never silent success. Treating `collectionId` differently
   (accepting it uncritically) would be an inconsistent exception to
   that pattern for no clear benefit.
2. Silently accepting a foreign `collectionId` would let a bookmark
   permanently reference a collection its owner has no visibility into
   or control over (can't rename it, can't see it in `GET
   /collections`, can't have it null itself out if that collection is
   later deleted by its actual owner in a way the bookmark owner would
   never learn of) — a confusing, effectively-orphaned data state, even
   though it isn't an information-disclosure bug on its own.
3. Asked once, confirmed with the project owner (AskUserQuestion),
   rather than guessed silently, per this file's own process rule.

**Verification method**: e2e tests in `bookmarks.e2e-spec.ts` cover:
creating a bookmark with a `collectionId` owned by the caller
(succeeds), owned by another user (404), and nonexistent (404); same
404 behavior when moving an existing bookmark into another user's
collection via `PUT`. Reviewed via the security-reviewer checklist —
`assertCollectionOwned()` confirmed to run and reject *before* the
create/update query executes, not check-then-ignore.

---

## Decision: Global validation — reject unknown fields, array error messages, protocol-required URLs

**Context**: `class-validator` decorators already existed on the
Collections/Bookmarks DTOs (added when each module was built), but
nothing enforced them — no global `ValidationPipe` was registered, so
a missing required field (e.g. `name`) fell through to Prisma and
surfaced as a raw `500 Internal server error` instead of the `400`
documented in `API_DESIGN.md`. Wiring up enforcement raised three
sub-decisions that weren't specified anywhere:

1. Should an unrecognized field in the request body (e.g. a
   client-supplied `ownerId`, which every service already ignores at
   the query layer) be silently stripped, or rejected outright?
2. Should the `400` validation error `message` be Nest's default array
   of per-field error strings, or a single joined string (closer to
   the single-string style of `API_DESIGN.md`'s illustrative 404
   example, which isn't itself a validation-error example)?
3. `class-validator`'s default `@IsUrl()` (via `validator.js`) accepts
   a bare host with no scheme (e.g. `example.com`) as "valid" —
   arguably not what "malformed URL → 400" was meant to catch for a
   bookmark, which needs a fully-qualified URL to actually be openable.

**Decision**:
1. **Reject with 400** (`whitelist: true, forbidNonWhitelisted: true`
   on a global `ValidationPipe`) rather than silently stripping unknown
   fields. This is a deliberate behavior change from what was manually
   verified earlier in this project (a `PUT` with a spoofed `ownerId`
   in the body previously succeeded with `200`, `ownerId` silently
   ignored) — that request now returns `400` instead. Chosen over
   silent stripping for defense in depth: failing loudly on
   unrecognized fields is stricter and surfaces client bugs (or probe
   attempts) rather than quietly swallowing them.
2. **Array of per-field messages** (Nest's default `ValidationPipe`
   behavior), e.g. `message: ["name should not be empty"]`. Kept the
   standard behavior rather than writing custom string-joining logic,
   since it's more useful to a client with multiple invalid fields at
   once and still matches the documented `{statusCode, message, error}`
   shape structurally.
3. `@IsUrl({ require_protocol: true })` on both `CreateBookmarkDto` and
   `UpdateBookmarkDto`'s `url` field, so a bare host without `http(s)`
   is now rejected as malformed, not silently accepted.

A global `AllExceptionsFilter` (`@Catch()`) was also added so that
*every* error response — including uncaught/unexpected errors, which
Nest's default handling returns as `{statusCode, message}` only, no
`error` key — consistently has the exact three-key shape from
`API_DESIGN.md`. `404`/`401` responses already matched this shape
before via Nest's default `HttpException` handling (verified by
pre-existing tests); this mainly closes the gap for `500`s.

**Reasoning**: All three sub-decisions were asked and confirmed with
the project owner (`AskUserQuestion`) rather than guessed silently,
per this file's own process rule.

**Verification method**: The gap was confirmed empirically before
implementing anything (`POST /collections` with a missing `name`
returned real `500`, captured via a throwaway test, deleted after).
New e2e tests (2 in `collections.e2e-spec.ts`, 3 in
`bookmarks.e2e-spec.ts`) were written first and confirmed failing, then
implementation followed. The fix was proven causal, not coincidental,
by temporarily reverting `configureApp()` to skip registering the
`ValidationPipe` and re-running the new tests — all 5 failed
(including the missing-`name` case reproducing the original `500`
verbatim), then passed again once restored. Unit tests for
`AllExceptionsFilter` (3 cases: `HttpException` passthrough, array-
message `BadRequestException` passthrough, generic `Error` → sanitized
`500`) cover the filter directly. Full suite: 47 e2e + 8 unit tests
passing, clean build.

---

## Decision: Redacting an already-pushed dev DATABASE_URL rather than rewriting history

**Context**: `transcripts/session-2-backend-task-1-3.md` (already
committed and pushed) contained the local dev `DATABASE_URL`
(`postgresql://dev:dev_password@localhost:5432/bookmark_manager`) in
plaintext, captured verbatim from a terminal transcript of writing
`backend/.env.example`.

**Decision**: Redact the credential portion in place
(`postgresql://[REDACTED]@localhost:5432/bookmark_manager`) in a new
commit, rather than rewriting git history (`git filter-repo`/
`rebase`+force-push) to remove it retroactively.

**Reasoning**: This is the same value already present, unredacted, in
`docker-compose.yml` (`POSTGRES_PASSWORD: dev_password`,
`DATABASE_URL: postgresql://dev:dev_password@postgres:5432/...`) —
and the security-reviewer checklist already assessed that exact value
in `docker-compose.yml` as an acceptable risk ("`dev_password`
hardcoded in plaintext — fine for a local-only dev compose file", per
`transcripts/session-1-phase0-setup.md`). It is a placeholder
`dev`/`dev_password` pair for a container that only ever binds to
`localhost`, not a real credential, not reachable outside the local
Docker network, and not something rotating or revoking would
meaningfully protect. Rewriting already-pushed history to scrub a
non-sensitive placeholder would cost more (force-push, coordination,
rewritten commit hashes) than it protects against. Real credentials
(Auth0 client secrets, actual JWTs, `.env`/`.env.local` contents)
remain a hard "never commit, redact before staging" rule — this
decision applies specifically to this already-assessed, non-sensitive
placeholder value, not a general exception.

**Outcome**: Redacted in place going forward; `CLAUDE.md`'s Git
workflow section now requires scanning `/transcripts/` content for
JWTs, `code_verifier`/`code_challenge` values, authorization codes,
and `.env` contents before staging, to catch this category before it
reaches a commit next time.

---

## Decision: Frontend PKCE implementation — hand-rolled vs `@auth0/auth0-spa-js`

**Context**: The frontend needs to implement the Authorization Code +
PKCE (S256) flow against Auth0 (per `CLAUDE.md`/`API_DESIGN.md` — no
implicit flow). Two realistic paths: hand-roll the PKCE mechanics
directly (Web Crypto for `code_verifier`/`code_challenge`, manual
`fetch` calls to `/authorize` and `/oauth/token`), or use the official
`@auth0/auth0-spa-js` SDK, which implements PKCE internally.

**Decision**: Hand-rolled.

**Reasoning**:
1. `DECISIONS.md` already commits to `sessionStorage` for token
   storage (see "Token storage location on the frontend"). auth0-spa-js's
   built-in cache only supports `'memory'` or `'localstorage'` as a
   `cacheLocation` — `sessionStorage` would require writing a custom
   `ICache` adapter, at which point most of the SDK's storage-management
   value is bypassed anyway, and the code ends up fighting the SDK's
   assumptions instead of using them.
2. The backend's JWT validation (JWKS/`iss`/`aud`/`exp`) was
   deliberately implemented and tested by hand rather than delegated to
   an opaque helper — hand-rolling the frontend's PKCE mechanics keeps
   the same standard of understanding and controlling the
   security-critical path across the stack, rather than delegating half
   of it to a third-party SDK.
3. Full control makes the security-sensitive pieces directly
   unit-testable as pure functions: `code_verifier`/`code_challenge`
   generation is verified against the RFC 7636 Appendix B test vector
   with no SDK internals to mock.
4. Trade-off accepted knowingly: the SDK is battle-tested and handles
   concerns hand-rolled code must re-derive itself (silent refresh via
   refresh tokens, spec-compliant retry/edge-case handling, browser
   quirks). Given this project's scope (one test tenant, no
   refresh-token rotation requirement), that trade-off was judged
   acceptable.

**Verification method**: TDD throughout — Vitest unit tests covering
PKCE generation (RFC 7636 test vector), CSRF state-mismatch rejection,
one-time-use cleanup of `state`/`code_verifier` on both success and
failure paths, and the token-exchange request shape (mocked `fetch`,
confirms no `client_secret` is ever sent). 35 tests passing.
`/security-review` — CLEAR TO COMMIT, no CRITICAL/FAIL findings
(commit `339c6c1`). End-to-end verification against the real Auth0
tenant is still pending — route/page wiring (`/`, `/callback`) isn't
built yet.