# Plan: Read-only iOS Client for the MailStash Archiver

_Date: 2026-08-09. Supersedes the broader `ios-client-and-proton-design.md` **for now** — that doc stays as the north star (send, push, Proton), but this is the near-term scope._

## Scope

A native iOS app that is a **read-only frontend onto the existing archiver**. No new mail infrastructure.

**In scope:**
- **Monitor status** — accounts, sync state, last-sync, storage, job success/failure.
- **Browse** archived mail — accounts → folders → messages → message detail (body + attachments).
- **Search** — and make search actually good (the current search is weak; fixing it benefits web too).
- **Get the UI right** — this is a primary goal, not a side effect. A dense, familiar, well-designed mail UI.

**Explicitly deferred** (own the north-star doc): compose/send, APNs push, Proton, threading-as-conversations (nice-to-have but not required for v1), write-back (mark read/flag/move).

## Why this is cheap

The service layer **already exposes everything** a read-only client needs — the web app calls these today:

| Need | Existing service method |
|---|---|
| Accounts + stats | `AccountsService.getUserAccountsWithStats` |
| Per-account/global stats | `StatsService.getUserStats` |
| Sync status per account | `JobStatusService.getCurrentStatus` |
| Job history / activity | `JobStatusService` + `sync-jobs` data |
| Email list + search | `EmailsService.getUserEmails` |
| Email detail + body + attachments | `EmailsService.getEmailDetails` (reads `.eml`) |

So the backend work is mostly: **expose these over a token-authed mobile API**, not build new capability. The one substantive backend improvement is **search** (worth doing regardless — issue #8).

## Backend work

### Principle: ONE API for web and iOS — no mobile-specific surface
There is a single authenticated `/api/*` surface; **web and iOS are both clients of it.** No `/api/mobile/*`. Anything manageable in one place is manageable in the other, by construction, because there's only one set of endpoints. The web app's server components may still call services directly for SSR, but every interactive/managed capability goes through the same REST endpoints the iOS app uses. This avoids the drift and double-maintenance of parallel APIs.

### 1. Prerequisite: API-helper layer (issue #4)
The unified API must not sit on the current hand-rolled routes (inconsistent auth, two unauthenticated endpoints — #3). Land `withAuth` + typed errors + zod first, then build on it. Small, and it hardens the whole surface for both clients.

### 2. Dual-credential auth on the same routes
The single `withAuth` guard resolves **either** credential type into the same `userId`, so routes are identical regardless of client:
- **Web:** next-auth **session cookie** (as today).
- **iOS:** **bearer token** (OAuth2 access + refresh, device-bound), issued on top of the existing Google sign-in — no new identity system.

`withAuth` tries cookie → falls back to `Authorization: Bearer` → yields `userId`; the handler never knows or cares which. This is the mechanism that makes "one API, both clients" real.

### 3. Promote `/api/*` into the unified REST API (all `withAuth`, user-scoped)
These are consumed by both web (client components / TanStack Query) and iOS. Mostly they wrap services the web already calls:
```
POST /api/auth/token          # code → {access, refresh}   (iOS token issuance)
POST /api/auth/refresh

GET  /api/accounts            # list + status, stored counts, lastSyncAt   ← getUserAccountsWithStats
GET  /api/accounts/:id        # detail + sync status                        ← getAccountDetails + getCurrentStatus
GET  /api/stats               # dashboard numbers                           ← getUserStats
GET  /api/jobs?accountId=     # recent sync jobs / activity (read-only)     ← sync-jobs data
                              #   (this REPLACES the unauthenticated /api/jobs/status — see #3)

GET  /api/emails?accountId=&q=&folder=&cursor=&limit=  # list + search      ← getUserEmails
GET  /api/emails/:id          # detail: headers, html/text body, attachments ← getEmailDetails
GET  /api/attachments/:id     # stream/download an attachment
```
Notes:
- **Cursor pagination** (not page numbers) for infinite scroll — web can adopt it too.
- Read-only for this phase: no read/flag/move/trash. (Opening a message may still mark-read server-side as today — decide; arguably this phase shouldn't mutate at all.)
- Bodies come from the `.eml` on demand, exactly as `getEmailDetails` does now.
- Where the web currently uses server components calling services directly, that can stay for SSR — but the *same data* is available via these endpoints, so nothing is web-only or app-only.

### 4. Search improvements (issue #8) — the one real feature
Current search only matches `subject`/`from`/`to` and can't search bodies or parse operators. For a browse-the-archive app, search *is* the primary way in. Minimum for v1:
- **Body search** — add a `bodyText` column populated at sync/import from the parsed `.eml`, + Postgres full-text (`tsvector` + GIN). This is the substantive change.
- **Operator parsing** — `from:`, `to:`, `subject:`, quoted phrases.
- **Scope** — all-accounts vs one; the API already supports it, expose it explicitly.
- All of this benefits the web UI identically — do it in the shared service/DAO, not the mobile route.

## iOS app (this is where "get the UI right" happens)

### Framework decision: native **SwiftUI**, iOS-first
Chosen over Flutter / React Native because:
- **UI quality is the primary goal.** A mail client lives on feel — density, swipe gestures, scroll/list performance, native navigation. SwiftUI renders real UIKit/SwiftUI components and gets Apple's APIs on day one; Flutter paints its own pixels, RN adds a JS bridge + customization friction.
- **The shared-code argument for cross-platform is already satisfied by the single backend API.** The app is a thin read-only client with little on-device business logic, so a cross-platform framework would buy code-sharing we don't need at the cost of native polish we do.
- **Small surface** (read → cache → render) sits in SwiftUI's sweet spot; its verbosity downsides are muted.
- **Android later, if ever:** a separate native app (Jetpack Compose) sharing this same backend API — not a compromise framework now. (Full rationale: `spark-clone-feasibility.md` §Tooling + framework research.)

### Stack (all mature, off-the-shelf — no email-protocol library on device)
- **SwiftUI** app.
- **Local cache:** SwiftData or GRDB — cache the list/detail so scrolling and re-open are instant and it works offline-read.
- **Networking:** URLSession + async/await against the unified `/api/*`; token refresh in an interceptor.
- **Keychain** for tokens.

### Screens (v1)
1. **Status / dashboard** — per-account cards: connected/disconnected, last sync, stored count, storage used, sync running/failed. This directly scratches your monitoring itch (you'd have seen the disconnect from #6 here).
2. **Mailbox list** — dense, single-line rows (the review's #9 fix, done right from the start on native): sender · subject — snippet · date, unread affordance, attachment indicator. Account/folder scoping.
3. **Search** — prominent, with the new operators/body-search; scope toggle (all vs account).
4. **Message detail** — rendered HTML body (WKWebView, sanitized), headers, attachment list with download.

Design intent: match the density and muscle-memory of Spark/Apple Mail. The `frontend-design` skill can steer the visual system. This is the deliverable to nail.

## Build order
1. **API-helper layer** (#4) — prerequisite.
2. **Token auth** endpoints.
3. **Read-only mobile API** — accounts/stats/jobs/emails/detail/attachments over existing services.
4. **Search upgrade** (#8) in the shared service/DAO (body FTS + operators + scope).
5. **iOS app** — status dashboard first (fastest value + validates auth/API), then list, search, detail.
6. **Polish the UI** — density, states, gestures.

## Explicit non-goals for this phase
Compose/send · APNs push · Proton · conversation threading · write-back mutations · offline *compose*. All tracked in `ios-client-and-proton-design.md` for later — this phase deliberately avoids every piece of net-new mail infrastructure so the app can ship and the UI can be iterated.
