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

*(To be filled in during implementation — not fabricated in advance.
This section will document real instances found via testing, per
§5's requirement to disclose 2-3 concrete cases.)*