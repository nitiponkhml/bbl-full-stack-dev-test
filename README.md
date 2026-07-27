# BBL Bookmark Manager

A private, per-user read-later/bookmark manager built for Bangkok Bank's full-stack candidate test — NestJS + Prisma + PostgreSQL backend, React + Vite + MUI frontend, Auth0 OIDC (Authorization Code + PKCE) for authentication.

## 1. Setup

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start Postgres only (backend/frontend run outside Docker during development)
cd ..
docker-compose up -d postgres

# Copy env templates and fill in real values
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Apply the database schema and seed 2 test users
cd backend
npx prisma migrate deploy
npm run prisma:seed
```

## 2. Running

**Backend** (from `backend/`):

```bash
npm run start:debug
```

**Frontend** (from `frontend/`):

```bash
npm run dev
```

The frontend **must** run on `http://localhost:3000` — the Auth0 tenant's Allowed Callback/Logout URLs are locked to that exact origin (`vite.config.ts` already pins the dev server to port 3000; don't override it).

**Alternative — run everything via Docker** (production-mode build, not hot-reload):

```bash
docker-compose up --build
```

This builds and runs Postgres, the backend, and the frontend together (frontend on `:3000`, backend on `:3001`). Verified working end-to-end in this repo: both images build, the backend starts and maps all routes, and the frontend bundle correctly bakes in the Auth0/API config from Docker build args.

## 3. Tests

**Backend** (from `backend/`):

```bash
npm run test       # unit tests
npm run test:e2e   # e2e tests (needs Postgres reachable via DATABASE_URL; JWKS is mocked internally, no live Auth0 call needed)
```

**Frontend** (from `frontend/`):

```bash
npm run test
```

## 4. Test credentials

```
candidate@test.com / @password1234
```

(From the brief — use this account to sign in via Auth0's hosted Universal Login.)

## 5. What's done vs skipped

**Core requirements (§3.1 backend) — all done:**
- NestJS + Prisma + PostgreSQL, OIDC Access Token (RS256) validated via JWKS on every route (signature, `iss`, `aud`, `exp`)
- Full CRUD on `/collections` and `/bookmarks` (get one, list, create, PUT, PATCH, delete), `?name=` and `?collectionId=` filters
- `/me`, `GET /collections/:id/bookmarks`
- Deleting a collection uncategorises its bookmarks rather than cascading (`onDelete: SetNull`)
- Seed script for 2 users with asymmetric data, so cross-owner isolation is visually obvious

**Core requirements (§3.2 frontend) — all done:**
- React + Vite + TypeScript + React Router v8 + MUI v9
- `/collections` and `/bookmarks`: list, create, edit, delete, filtering by collection — both fully connected to the real backend API (Bearer Access Token on every request)
- "View" is inline (each list item shows its full detail — name/URL/title/notes — directly), not a separate detail route; not required by the API design as a distinct frontend page

**§3.3 (collection sharing) — documented, not implemented.** Treated as a soft/optional ask sitting directly against this project's core privacy invariant, not a numbered requirement. See `DECISIONS.md` → "Decision: Collection sharing (§3.3)" for the full reasoning and the two candidate designs considered for a future pass.

**Bonuses:**
| Bonus | Status |
|---|---|
| Docker | **Done** — `docker-compose.yml` + Dockerfiles for both services, verified with a real `docker-compose up --build` run (see §2) |
| CI/CD | Not attempted — no pipeline configured |
| `/all` route | Not attempted — scope stayed at exactly `/collections` and `/bookmarks` per `DECISIONS.md`'s frontend routing decision (`/` and `/callback` exist only to support the OIDC flow, not as extra product pages) |
| Full-text search | Not attempted |

## 6. Project docs

- **`DECISIONS.md`** — every non-obvious decision and ambiguity resolution (Bearer token type, token storage location, collection sharing, etc.), ADR-style with context/reasoning/outcome
- **`API_DESIGN.md`** — the API contract, plus a "where the agent's first attempt was wrong" section with real cases found during testing
- **`AI_WORKFLOW.md`** — tools/models used, how the work was decomposed, and where AI did well vs got it wrong
- **`/transcripts/`** — exported session transcripts

## 7. A note on `.claude/` vs `/.agent/`

This repo uses `.claude/` (commands, agents, skills) rather than the brief's suggested generic `/.agent/` path, since it was built with Claude Code specifically — `.claude/` is its native convention and provides real, working tooling (e.g. `.claude/commands/commit.md`) rather than a folder matching the brief's wording with no actual effect. See `DECISIONS.md` → "Decision: Agent config path — `.claude/` vs `/.agent/`" for the full reasoning.
