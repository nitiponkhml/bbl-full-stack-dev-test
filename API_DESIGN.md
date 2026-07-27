# API_DESIGN.md

## Authentication

- OIDC via Auth0, Authorization Code + PKCE (S256) — no implicit flow.
- Bearer credential: **Access Token (RS256, JWT)** — see DECISIONS.md
  for full rationale.
- Every protected route validates the Access Token via JWKS:
  - Signature verified using the JWKS key matching the JWT's `kid`
    (supports key rotation — the tenant currently publishes 2 keys)
  - `iss` must equal `https://dev-yg.us.auth0.com/`
  - `aud` must include `https://bbl-candidate-test-api`
  - `exp` must not have passed
- `ownerId` for all data access is derived from the token's `sub`
  claim — never from a client-supplied value (request body, query
  param, or path param).

## Resources

### `GET /me`
Returns the current signed-in user's identity derived from the token.

| Field | Source |
|---|---|
| `sub` | Access Token `sub` claim |

### `/collections`

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `name` | string | required |
| `ownerId` | string | derived from token `sub`, never client-supplied |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

| Method | Path | Description |
|---|---|---|
| `GET` | `/collections` | List collections owned by the caller; supports `?name=` filter (partial, case-insensitive match) |
| `GET` | `/collections/:id` | Get one collection (404 if not owned by caller) |
| `POST` | `/collections` | Create a collection |
| `PUT` | `/collections/:id` | Full update (404 if not owned by caller) |
| `PATCH` | `/collections/:id` | Partial update (404 if not owned by caller) |
| `DELETE` | `/collections/:id` | Delete (see on-delete behavior below) |
| `GET` | `/collections/:id/bookmarks` | List bookmarks within a collection |

**On-delete behavior**: deleting a collection sets `collectionId` to
`null` on any bookmarks that belonged to it (bookmarks are not
cascade-deleted) — a bookmark can be uncategorised, per §3.1.

### `/bookmarks`

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `url` | string | required |
| `title` | string | required |
| `notes` | string? | optional |
| `collectionId` | string? | optional (nullable — uncategorised) |
| `ownerId` | string | derived from token `sub`, never client-supplied |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

| Method | Path | Description |
|---|---|---|
| `GET` | `/bookmarks` | List bookmarks owned by the caller; supports `?collectionId=` filter |
| `GET` | `/bookmarks/:id` | Get one bookmark (404 if not owned by caller) |
| `POST` | `/bookmarks` | Create a bookmark |
| `PUT` | `/bookmarks/:id` | Full update (404 if not owned by caller) |
| `PATCH` | `/bookmarks/:id` | Partial update (404 if not owned by caller) |
| `DELETE` | `/bookmarks/:id` | Delete |

## Privacy invariant enforcement

Every query against `Collection` or `Bookmark` is scoped with
`WHERE ownerId = <sub from validated token>`. A request for a
resource ID that exists but belongs to another user returns `404 Not
Found` — never `403 Forbidden` — so that the caller cannot distinguish
"doesn't exist" from "exists but isn't yours" (avoids leaking existence
of other users' data, per the invariant in §3).

## Status codes

| Code | When |
|---|---|
| `200 OK` | Successful GET, PUT, PATCH |
| `201 Created` | Successful POST |
| `204 No Content` | Successful DELETE |
| `400 Bad Request` | Validation failure (e.g. missing required field, malformed URL) |
| `401 Unauthorized` | Missing/invalid/expired Access Token, or signature/iss/aud check fails |
| `404 Not Found` | Resource doesn't exist, or exists but isn't owned by the caller (see privacy invariant below) |

## Error shape

```json
{
  "statusCode": 404,
  "message": "Collection not found",
  "error": "Not Found"
}
```

## Collection sharing (§3.3)

**Not implemented.** §3.3 phrases sharing as a soft desire ("a user
may want to..."), not a numbered requirement, and it sits directly
alongside this project's core invariant (§3: a user must never see,
edit, or learn of the existence of another user's data). Any sharing
mechanism is a controlled exception to that invariant, so it was
deliberately left out rather than partially built under time pressure.

No `Collection`/`Bookmark` route or query in this document has a
cross-user read/write path — the privacy invariant above is absolute,
by construction, not by a feature flag.

Full reasoning and the two candidate designs for a future pass
(named-user grants vs. an identity-blind share-link token) are in
`DECISIONS.md` — "Decision: Collection sharing (§3.3)".

---

## Where the agent's first attempt was wrong

### 1. Incorrect assumption about CORS header behavior in a test

- **What happened**: The first `cors.e2e-spec.ts` test for a
  third-party origin asserted
  `access-control-allow-origin` would be `undefined` on a request from
  `http://evil.example.com`, on the assumption that a disallowed
  origin gets no header at all.
- **How I caught it**: Ran the test immediately after implementing
  CORS (TDD) — it failed, showing the header was present and equal to
  `http://localhost:3000`, not absent.
- **Finding**: With a single fixed-string `origin` config (not a
  wildcard or a reflect-the-request-origin function), the `cors`
  package always returns that one literal value on every response,
  regardless of the incoming `Origin` header — it never omits the
  header. The actual security property isn't "no header for bad
  origins," it's "the header can never be made to equal an arbitrary
  origin" — the browser at the disallowed origin rejects the response
  itself because the header doesn't match its own origin.
- **Fix**: Corrected the test to assert the header is present but
  fixed (`toBe('http://localhost:3000')`) and explicitly `not.toBe`
  the disallowed origin, with a comment explaining why. Verified via
  `/security-review`, which independently confirmed this is the
  correct, secure behavior for a single-origin config.

### 2. Missing error handling on every create/edit/delete mutation

- **What happened**: `Collections.tsx`/`Bookmarks.tsx`'s `save()` and
  `confirmDelete()` functions (and a `collections`-dropdown-loading
  effect in `Bookmarks.tsx`) chained `.then()` with no `.catch()` at
  all. A failed create/edit/delete left the dialog silently open with
  zero user feedback, and was a genuine unhandled promise rejection.
- **How I caught it**: `App.test.tsx`'s unmocked `apiClient` call
  happened to hit a real backend instance reachable at
  `localhost:3001` during a test run, which correctly rejected the
  test's fake (unsigned) JWT with a real `401` — surfacing the
  unhandled rejection in Vitest's output. Not something a mocked unit
  test would have caught on its own.
- **Finding**: All four mutation call sites across both pages had the
  same gap — a defect class, not an isolated typo.
- **Fix**: Wrote a failing regression test per call site first (TDD),
  then added `.catch((err) => setError(...))` reusing the existing
  error `Alert`, and a deliberately silent `.catch(() => {})` on the
  non-critical dropdown-loading effect. `/security-review` confirmed
  the new error messages don't leak anything beyond the already-vetted
  `ApiError` shape.

### 3. Installed a jsdom version that silently broke MUI Dialog tests

- **What happened**: `npm install -D vitest jsdom ...` pulled jsdom
  `30.0.0` (latest at install time). The first tests exercising an MUI
  `Dialog` (create/edit/delete confirmation) failed with an internal
  jsdom error (`resolveLengthInPixels`, `object null is not
  iterable`), not a test-logic error.
- **How I caught it**: Traced the failure to jsdom's CSS `calc()`/
  font-size resolution helper by reading the stack trace instead of
  assuming the test or component code was wrong, then bisected by
  downgrading jsdom to `26.1.0` and re-running — same suite, all
  green.
- **Finding**: jsdom 30.0.0 has a real CSS-calc/font-size resolution
  bug incompatible with MUI v9's `Dialog`; unrelated to any code in
  this project.
- **Fix**: Pinned `jsdom` to `^26.1.0` in `frontend/package.json`,
  documented the reason in the commit message so it isn't silently
  bumped back to a broken version later.