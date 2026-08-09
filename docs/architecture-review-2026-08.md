# MailStash Architecture & Code-Reuse Review

_Review date: 2026-08-09. Covers `app/api`, `lib/services`, `lib/dao`, `lib/jobs`, `lib/email`, `components`, `hooks`, `types`._

The codebase has a **sound underlying shape** — a DAO → Service → API/route separation, a `createJobHandler` abstraction that every job handler actually uses, a `ui/` primitive library, and TanStack Query wired in. The problems are consistency and follow-through: the good patterns aren't applied uniformly, so the same job (auth a request, resolve a user's accounts, map a job status to a label, store an email) is done 2–4 different ways across the tree.

Findings are grouped by theme and ranked. **Bugs** (verified) are called out first because they're not just refactors.

---

## 🔴 Verified bugs — fix regardless of any refactor

### B1. Two API endpoints have no authentication
- **`app/api/jobs/status/route.ts`** — `GET` has no `auth()` call. It returns system-wide worker status and active/pending/failed job lists (which include account ids and job metadata) to any unauthenticated caller. The *same* data is correctly gated behind a session in `app/api/jobs/route.ts`.
- **`app/api/jobs/retry/[id]/route.ts`** — `POST` has no auth and no ownership check. Any caller can reset **any** job id for retry.

**Fix:** add the session guard to both (ideally via the `withAuth` wrapper in R1). If `jobs/status` is meant to be an ops/health endpoint, protect it with a shared secret or fold it into the authenticated `jobs` route.

### B2. Inconsistent auth guard weakens three job routes
`app/api/jobs/route.ts:8`, `jobs/retry/[id]/route.ts`, and `jobs/sync/route.ts` check `if (!session?.user)` while every other route checks `session?.user?.id`. These three then operate on jobs with **no per-user ownership scoping**. Standardize on `session?.user?.id`.

### B3. CSS typo disables an error-state background
`components/accounts/sync-status.tsx:29` — `'text-red-600 bd-red-50'`. `bd-red-50` isn't a Tailwind class; should be `bg-red-50`. The sync-error state currently renders with no background.

### B4. `sync-button` stale local state
`components/accounts/sync-button.tsx:20` seeds `useState(initialSyncing)` from a prop and never reconciles on prop change. After `router.refresh()` updates the parent's `account.syncStatus`, the button keeps its stale local value. Derive from the prop (or the query cache) instead of copying it into state once.

### B5. `worker.ts` duration metric is inverted
`lib/jobs/worker.ts:78-82` computes `duration` only when `job.last_error` is truthy, so clean successes always log `duration: undefined` and only previously-errored jobs get a number. The condition looks backwards.

---

## 🟠 Cross-cutting duplication (highest refactor leverage)

These are the same logic repeated across layers — the biggest wins because one abstraction removes many copies.

### X1. Job-status → sync-status string mapping — duplicated 6+ times
The ternary `status === 'running' ? 'syncing' : status === 'error' ? 'error' : 'idle'` (and its `'processing'/'completed'/'failed'` sibling) appears in:
`accounts.dao.ts:114`, `accounts.dao.ts:219`, `stats.dao.ts:162`, `stats.dao.ts:107` (`determineOverallSyncStatus`), `app/api/sync/route.ts:129`, `app/api/sync-jobs/route.ts:48`, and again in `components/recent-activity.tsx:59`.

**Fix:** one `mapJobStatusToSyncStatus(status)` helper on `JobStatusService` (where the `CurrentStatus` type already lives). Both the string contract and the styling map should live in one place — `lib/constants/account-styles.ts` already holds `getSyncStatusStyle`, so co-locate there.

### X2. "Resolve the current user's accounts" — three inconsistent variants
- `emails.service.ts:28` & `:100` → `AccountsDAO.findAccounts(userId)` — does **not** filter `isActive`.
- `stats.service.ts:17` → `AccountsDAO.findAccountsWithJobStatus(userId)` — **does** filter `isActive: true`.

So emails and stats operate on different account sets for the same user, and `findAccounts`'s doc-comment still says "Find user's active accounts" (stale after the disconnected-account fix). Make the active-filter an explicit parameter and consolidate on one resolution method.

### X3. "Verify account belongs to user" — done four ways with three different 404 messages
`AccountsService.validateUserAccess` exists and is used by two routes, but `dry-run-status/route.ts:20`, `sync/route.ts:31`, and `jobs/sync/route.ts:22` each inline their own `db.emailAccount.findFirst({ where: { id, userId } })` with differing `isActive` handling and differing error copy. Route every ownership check through `validateUserAccess` (extend it with a `{ requireActive }` option).

### X4. `ParsedMail → EmailMessage` normalization — three independent copies
`gmail-client.ts:180`, `imap-client.ts:110` (`parseImapMessage`), and `mbox-parser.ts:248` (`convertToEmailMessage`) each build an `EmailMessage` with their own message-id defaulting, their own boolean-flag conventions, and their own address formatting. Two of the three (IMAP, mbox) already both consume mailparser's `ParsedMail` yet don't share a mapper.

**Fix:** a shared `parsedMailToEmailMessage(parsed, defaults)` plus `normalizeMessageId()` and an address formatter, reused by IMAP and mbox; Gmail shares the id/address helpers even though its body source differs.

### X5. Hand-maintained types duplicate the Prisma schema
`types/index.ts` re-declares `Email`, `Folder`, `Attachment` as hand-written interfaces mirroring the Prisma models — they can drift from the schema, and only `lib/db.ts` + one service use the generated types. The `labels: string | string[]` field ("Can be JSON string or parsed array") is a leaky serialization boundary. Prefer Prisma-generated types (with `Omit`/`Pick` for API-facing shapes) and normalize `labels` at one boundary so the union type disappears.

Also overlapping: `AccountWithStats` vs `AccountDetails` (~90% identical, `accounts.dao.ts:23` / `:38`) and `AccountCreationResult` (`accounts.service.ts:25`) — collapse via `extends`/`Omit`. The "sum email size for account" aggregate is written three times (`accounts.dao.ts:92`, `:197`, `stats.dao.ts:27`).

---

## 🟠 Layer-boundary issues

### L1. The DAO boundary is half-applied
DAOs own the read path (accounts/emails/stats), but the entire `sync/**` tree, `auto-delete-service.ts`, `mbox-import-service.ts`, `gmail-token-manager.ts`, and `job-status.service.ts` hit `db` (prisma) directly. Since that's where most `Email` **writes** happen, "the DAO owns Email queries" isn't true. Either commit to DAOs for `Email`/`Folder`/`JobStatus` access or drop the pattern — the middle ground is the confusing part.

### L2. DAOs depend on Services (dependency inversion)
`accounts.dao.ts:8` imports `JobStatusService` and calls it inside DAO methods (`:99`, `:203`); `stats.dao.ts` does `await import('@/lib/services/job-status.service')` dynamically (`:107`, `:138`) and contains pure formatting/business logic (`formatSingleAccountStats`, `createEmptyStats`). This inverts the intended layering and reduces `stats.service.ts` to a pass-through. Move the `JobStatusService` calls and status/format logic **up** into the services; keep DAOs to prisma queries returning raw rows.

### L3. Business logic leaking into API routes
Several routes reach into `db` and embed real logic instead of delegating:
- `dry-run-status/route.ts:20-131` — ownership query + `email.count` + a status `switch`, all inline (plus leftover `console.log`s at `:44`, `:74`).
- `sync/route.ts:31-79` — ownership + sync-type decision logic, duplicated in a *different* form in `jobs/sync/route.ts:34-46`.
- `sync-jobs/route.ts:15-58` — `findMany` + N+1 loop of `getCurrentStatus` + response shaping.

A `SyncService.scheduleForAccount(userId, accountId)` would let `sync/route.ts` and `jobs/sync/route.ts` share one implementation and one sync-type decision.

### L4. Business/DB logic inside React components
- `components/recent-activity.tsx:23-107` runs five DB round-trips + two `Promise.all(getCurrentStatus)` fan-outs and re-derives status strings **inside the component body** (and imports `db` directly at `:11`, which no other component does). Move to a `RecentActivityService.getActivitySummary(userId)` returning a view model.
- `components/sync-frequency-selector.tsx` — `parseCronExpression`/`validateCronExpression` (`:98`) and `getNextSyncTimes` (`:330`) are pure cron utilities living in a component. Move to `lib/utils/cron.ts` (testable, reusable).

---

## 🟠 The two sync services & the two schedulers

### S1. `full-sync-service.ts` and `incremental-sync-service.ts` are near-parallel
Duplicated between them: the `SyncDependencies`/`defaultDeps` block + provider dispatch (`full:18-45` / `incremental:19-45`); a **byte-identical** `logFailedMessage` (`full:268` / `incremental:355`); the "findFirst by (id, accountId) → fetch → store → count, catch → logFailedMessage" loop (`full:86` / `incremental:91`); the whole IMAP connect/iterate/store/`finally disconnect` shape; and result types differing only by `requiresFullSync`.

**Fix:** extract `sync/shared.ts` with `SyncDependencies`/`defaultDeps`, `logFailedMessage`, and a `storeIfNew(client, message, account, storage)` helper; share folder handling via a `FoldersDAO`.

### S2. Two `schedule*` implementations that drift
`lib/jobs/queue.ts` (uses `WorkerUtils.addJob`, called from routes) and `lib/jobs/utils/scheduler.ts` (uses `helpers.addJob`, called from handlers) both define `scheduleFullSync`/`scheduleIncrementalSync`/`scheduleAutoDelete` with **different rules**:
- `queue.ts` hardcodes `maxAttempts` (3/5) inline; `scheduler.ts` pulls from `JOB_CONFIG` and applies pause/manual/off gating that `queue.ts` omits.
- `scheduler.ts` uses `generateJobKey()` (from `config.ts:51`); `queue.ts` hardcodes the job-key string inline.

The only current `queue.scheduleAutoDelete` caller is gated by `autoDeleteMode === 'dry-run'` upstream, so this isn't presently a data-loss bug — but the divergent gating/`maxAttempts` is a live drift risk the moment a new caller appears. **Fix:** one `buildJobSpec(taskType, accountId, payload)` returning `{ taskId, payload, opts }`, consumed by both the `utils.addJob` and `helpers.addJob` paths, with gating in one place.

### S3. Dead payload fields in the incremental path
`scheduler.ts:36-40` writes `gmailHistoryId`/`lastSyncAt` into the incremental payload, but `syncGmailIncremental` ignores the payload and reads `startHistoryId` from the `_SYNC_STATE` folder (`incremental-sync-service.ts:56`). The `historyId` threaded through `full-sync.ts:42` and `incremental-sync.ts:27` is never consumed. Either wire it in (skip the DB read when present) or delete the fields from the payload and `types.ts`. Similarly, `retry.ts:74` `retryWithBackoff` is exported with **zero callers** — only `retryGmailOperation` is used.

### S4. Retry coverage is Gmail-read-only
`retryGmailOperation` wraps Gmail read paths, but **not**:
- `gmail-client.ts:349` `attachments.get` (the heaviest quota calls — bare, only `console.error`),
- `gmail-client.ts:517` `messages.trash` (called from auto-delete — bare),
- the entire `ImapClient` (`connect`/`search`/`fetchOne` — no retry anywhere; and `retry.ts`'s `isGoogleApiError` keys off numeric `.code`, so it wouldn't classify imapflow errors correctly anyway).

Wrap those calls; generalize the retry predicate (or add `retryImapOperation`) for imapflow's `.responseText`/string-code error shape.

---

## 🟡 The missing API helper layer

There is no server-side API helper module (`lib/api/dry-run.ts` is a client `fetch` wrapper). Every route re-implements the same three concerns:

### R1. Auth guard — copy-pasted in ~12 routes
`const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });` — add a `withAuth(handler)` wrapper that runs `auth()`, 401s on failure, and passes `userId` to the handler. Fixes B1/B2 as a side effect and makes "does this route check auth?" a single grep.

### R2. Error-to-response mapping — ~15 divergent catch blocks
Two incompatible shapes coexist (`{ error }` vs `{ status: 'error', error }`), some leak `error.message` and some hardcode `'Internal server error'`, and the "map a known message string → 404" block is copy-pasted three times (`accounts/[id]/route.ts:66`, `settings/route.ts:51`, `sync/route.ts:28`). This string-matching breaks silently if a service reword its message. **Fix:** typed domain errors (`NotFoundError`, `ForbiddenError`, `ValidationError`) + one `handleApiError(error)` mapper producing a single JSON shape; routes match on `instanceof`.

### R3. No request validation
Query/body parsing is ad-hoc: `parseInt(...)` with no bounds (`NaN` flows into services — `emails/route.ts:14`), `const { accountId } = body` with no check (`undefined` into a Prisma `findFirst` — `jobs/sync/route.ts:19`), raw `await request.json()` passed straight into services (`settings/route.ts:20`), and unguarded `request.json()` that 500s on malformed input. Add `zod` schemas + `parseQuery`/`parseJson` helpers returning 400 on failure.

---

## 🟡 Component / hooks consistency

### C1. Three data-fetching paradigms, no rule
Server components calling services directly (`account-list.tsx`, `recent-activity.tsx`), a hand-rolled `fetch`+`useState`/`useEffect` hook (`use-account.ts:33`), and TanStack Query (`use-dry-run-status.ts` only). `app/accounts/[id]/settings/page.tsx` uses **all three at once**. A `QueryProvider` is installed app-wide but used by one hook. The 401→signin redirect is re-implemented in three places. **Fix:** standardize on TanStack Query; migrate `use-account` and `use-settings-manager` mutations to `useQuery`/`useMutation` (gets cache invalidation, kills the manual `setSettings`+`refetch` juggling).

### C2. Duplicated UI primitives
- **Two `Header` components** (`components/header.tsx` vs `components/layout/header.tsx`) differing only by whether `<UserNav>` renders, plus a third inline copy in `account-creation-layout.tsx:22`. Keep one with an optional `user?` prop.
- **"Colored info box"** (`p-3 bg-X-50 border border-X-200 rounded-lg` + icon + title) copy-pasted ~11 times despite `ui/message-alert.tsx` and `ui/alert.tsx` existing. Add `info`/`warning` variants and replace.
- **Preset-picker block** duplicated within `auto-delete-settings.tsx` (delay `:169` / age `:214`) — extract `PresetNumberPicker`.
- **Inline date formatting** (`toLocaleString()` etc.) in `recent-activity.tsx`, `sync-frequency-selector.tsx`, `email-item.tsx` bypasses the existing `ui/date-display.tsx`.

### C3. Prop-drilling & type holes
- `components/settings-tabs.tsx:16` takes 11 props and forwards them straight through, rebuilding `setSettings({...settings, x})` inline per field. Consolidate into a `useAccountSettings` hook (merging the three settings hooks) or a `SettingsContext`.
- `use-settings-manager.ts:14` types a param as `any` (it's actually a `refetch`), and `SettingsTabsProps.onSaveSettings: () => void` (`settings-tabs.tsx:27`) mismatches the real `(updatedSettings?) => Promise<boolean>` — works by luck.
- `mbox-upload.tsx` (313 lines) inlines all TUS orchestration + ~8 debug `console.log`s + a `null as unknown as File` cast (`:150`). Extract a `useTusUpload` hook.

---

## Suggested sequencing

**Phase 0 — bugs (small, ship now):** B1–B5. B1/B2 are security; the rest are one-liners.

**Phase 1 — API helper layer:** R1 (`withAuth`, absorbs B1/B2) → R2 (typed errors + `handleApiError`) → R3 (zod). Highest duplication-removal per unit effort, and it hardens the surface.

**Phase 2 — pull logic to the right layer:** L2 (DAOs stop calling services) enables X1 (`mapJobStatusToSyncStatus`); L3/L4 move route/component logic into services; then X2/X3 consolidate account resolution + ownership.

**Phase 3 — jobs/email internals:** S2 (unify schedulers) + S3 (dead fields) together; S1 (shared sync base); X4 (`ParsedMail` normalization); S4 (retry coverage).

**Phase 4 — components:** C1 (standardize on TanStack Query) first — it unblocks C3; then C2 primitives; type cleanups.

**Phase 5 — types:** X5 (Prisma-generated types, kill the `labels` union) once the boundaries above are settled.
