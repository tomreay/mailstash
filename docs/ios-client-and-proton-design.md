# Design Sketch: Thin iOS Client API + Built-in Proton Support

_Date: 2026-08-09. Companion to `spark-clone-feasibility.md`. Two sketches: (1) the backend API + push surface MailStash must expose to serve a thin SwiftUI client, and (2) how to add Proton as a first-class provider via a bundled, user-invisible bridge._

---

# Part 1 — Backend API surface for a thin iOS client

**Principle:** the phone never speaks IMAP/SMTP. MailStash's existing Node engine (imapflow + mailparser + googleapis + the Proton provider from Part 2) stays the mail engine and exposes a normalized JSON/HTTP API. The app is SwiftUI over that API; new mail arrives via APNs. (Rationale in `spark-clone-feasibility.md` §Tooling.)

## Guardrail: build this on the API-helper layer first
The current routes hand-roll auth/error/validation (see issue #4) and have two unauthenticated endpoints (#3). **Do not extend that surface for mobile.** Land `withAuth` + typed errors + zod (#4) first, then build the mobile API on top. A public mobile client makes the current inconsistencies into real vulnerabilities.

## Auth for the app
- **OAuth2 + refresh tokens**, not web-session cookies. Add a token endpoint (or adopt an existing lib — Auth.js supports this) issuing a short-lived access JWT + long-lived refresh token bound to the device.
- Register the device on login (see Push) so the backend can target APNs.
- All endpoints below require `Authorization: Bearer <access>` and are **scoped to the authenticated user's accounts** (the ownership rule from the review's X3).

## Resource model (normalized across Gmail / IMAP / Proton)
The API speaks one vocabulary; the provider differences are erased server-side.

```
Account   { id, email, displayName, provider, isActive, status, unreadCount, ... }
Folder    { id, accountId, name, path, type: inbox|sent|archive|trash|custom, unreadCount }
Thread    { id, accountId, subject, participants[], lastDate, messageCount, unread, hasAttachments, folderIds[] }
Message   { id, threadId, accountId, from, to[], cc[], date, snippet, bodyRef, flags{read,flagged,...}, attachments[] }
Body      { messageId, html, text }            // fetched on demand from the .eml
Attachment{ id, messageId, filename, contentType, size, downloadUrl }
```

Notes:
- **Threads are first-class** (issue #10) — `threadId`/`gmailThreadId` already exist in the schema; the API returns threads, the app renders conversations.
- **Bodies are lazy** — list/thread responses carry snippets only; `GET …/body` reads the `.eml` on demand (mirrors today's `parseEmlContent`).

## Endpoints (v1, all under `/api/mobile/v1`, all `withAuth`)

```
# Auth & device
POST   /auth/token                 # exchange OAuth code → {access, refresh}
POST   /auth/refresh               # refresh → new access
POST   /devices                    # register APNs device token  {token, platform}
DELETE /devices/:token             # deregister (logout)

# Accounts & connect
GET    /accounts                   # user's accounts + status/unread
POST   /accounts/connect/:provider # begin connect flow (gmail|imap|proton) — see Part 2
DELETE /accounts/:id               # disconnect (ownership-scoped)

# Reading (the hot path)
GET    /accounts/:id/folders
GET    /folders/:id/threads?cursor=&limit=      # paginated by thread, newest first
GET    /threads/:id                              # thread + its messages (metadata)
GET    /messages/:id/body                        # lazy html/text from .eml
GET    /attachments/:id                          # stream/download
GET    /search?q=&scope=all|account|folder&cursor=   # unified search (issue #8)

# Mutations (write-back to the provider)
POST   /messages/:id/read          {read: bool}
POST   /messages/:id/flag          {flagged: bool}
POST   /threads/:id/move           {folderId}
POST   /threads/:id/trash
POST   /outbox                     # compose/send — see below

# Sync coordination
GET    /sync/cursor?accountId=     # opaque "since" token for delta sync
GET    /sync/delta?cursor=         # changes since cursor (new/updated/deleted ids)
```

## Two things that don't exist yet and are net-new

### Compose / send (`POST /outbox`)
MailStash is read-only today — **no SMTP path at all**. A client must send. Design:
- A provider-agnostic `SendService.send(accountId, draft)` that dispatches per provider: Gmail API `messages.send`, IMAP accounts via SMTP (new — add `nodemailer`), Proton via the bridge's SMTP (Part 2).
- Queue it as a job (reuse graphile-worker) so send is durable/retryable; return an outbox id the app polls or gets pushed on.
- Store sent copies + thread them.

### Delta sync + APNs push
- **Delta sync:** the app holds a local cache (SwiftData/GRDB) and calls `/sync/delta?cursor=` to catch up. Backend computes changes from its own store (it already syncs on a schedule).
- **Push:** iOS forbids persistent background IMAP connections, so **the backend owns realtime and pushes via APNs** ([APNs design](https://en.wikipedia.org/wiki/Apple_Push_Notification_service)). When a scheduled/idle sync ingests new mail for a user with a registered device → send an APNs notification (new-mail badge / content-available to trigger a background delta). Gmail has `watch`; IMAP/Proton rely on MailStash's existing periodic sync (tighten the interval for "active" accounts). This same APNs plumbing also delivers the **problem-notifications** capability (disconnect alerts, #7) — build it once.

## iOS side (all mature, off-the-shelf)
SwiftUI + **SwiftData or GRDB** (local cache/offline) + async networking (URLSession) + APNs handling + Keychain for tokens. No email-protocol library on the device — that's the whole point. This is "well-built API client app," not "mail client from scratch."

---

# Part 2 — Built-in Proton support (bundled bridge, invisible to the user)

**Goal:** the user picks "Proton", logs in, and it works — no separate Bridge install, no hydroxide setup. Proton is a first-class provider alongside Gmail/IMAP. The bridge is an **internal implementation detail** MailStash manages.

## The key idea: Proton hides behind the existing provider interface
MailStash already has a provider seam — `lib/email/client-factory.ts`:
```ts
export type EmailClient = GmailClient | ImapClient;
export function createEmailClient(account): EmailClient {
  switch (account.provider) { case 'gmail': …; case 'imap': …; }
}
```
Proton slots in as a **third case**. And because a bridge exposes Proton **as IMAP/SMTP**, a `ProtonClient` is ~90% the existing `ImapClient` pointed at a locally-managed endpoint. The sync services, storage, threading, and the entire Part-1 API stay provider-agnostic — they never learn Proton is special.

### Refactor the seam first (small, and the review already wants it)
The current `if (isGmailClient) … else if (isImapClient)` branching (duplicated across both sync services — review finding S1/#5) doesn't scale to a 3rd provider cleanly. Convert to a real interface before adding Proton:
```ts
interface EmailProviderClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getMailboxes(): Promise<EmailFolder[]>;
  getMessages(mailbox, opts): Promise<EmailMessage[]>;
  getRawMessage(mailbox, uid): Promise<string>;   // .eml
  send?(draft): Promise<void>;                     // optional until compose lands
}
```
Gmail/IMAP/Proton each implement it; `createEmailClient` returns `EmailProviderClient`; the `is*Client` guards and the branching disappear.

## Component: the bridge manager
A new server-side component that owns the lifecycle of bridge instances. This is where "built-in" lives.

```
lib/email/proton/
  bridge-manager.ts     # start/stop/health of bridge instances, port allocation
  proton-client.ts      # EmailProviderClient over the bridge's local IMAP/SMTP
  proton-auth.ts        # login flow: Proton creds + (bridge-specific) 2FA/mailbox pw
```

**What the bridge manager does:**
- On Proton account connect: provision a bridge instance for that account (see Multi-account below), run its auth, obtain the bridge's **local IMAP/SMTP credentials + ports**, and store them like IMAP settings (`imapHost=127.0.0.1`, `imapPort=<allocated>`, bridge password in the existing `imapPass` field — encrypted).
- Health-check bridges; restart on crash; surface failures into the **same** account-disconnect/notification path as a bad Gmail token (#6/#7). To the rest of the app a dead bridge looks like any inactive account.
- Bind bridge IMAP/SMTP to **loopback only** (its IMAP is unencrypted-local) — never exposed off the host.

**Which bridge binary:** hydroxide (MIT, headless — clean fit) or Proton Bridge (official, GPLv3, headless-is-a-hack). This is swappable behind `bridge-manager.ts`; that's the point of the abstraction. Do the **hydroxide maturity spike** (feasibility doc Phase 0) to pick.

## Multi-account: the operational reality
A bridge authenticates as **one Proton user**. So "built-in Proton" for N accounts means **N bridge processes** to supervise. Options, cheapest first:
- **Single-user / self-hosted (likely your case):** one bridge process, started with the app (docker-compose service or a child process the manager supervises). Simplest; matches the self-hosted model.
- **Few accounts:** a small pool of bridge processes, one per connected Proton account, on dynamically allocated loopback ports, supervised by `bridge-manager.ts`.
- **Many/multi-tenant:** a bridge-per-account orchestration tier (containers). This is where "built-in" gets heavy — and where the feasibility doc's multi-tenant caveats bite. Probably out of scope.

## Connect flow (what the user sees vs. what happens)
```
User taps "Add Proton" in app
  → POST /accounts/connect/proton  {email, password, [2FA], [mailbox pw]}
  → backend: bridge-manager provisions/auths a bridge for these creds
  → backend: stores account as provider=proton with loopback IMAP/SMTP coords
  → backend: kicks off initial full sync via the normal sync engine
  → app: account appears, mail flows in — identical to Gmail/IMAP
```
The user never hears the word "bridge."

## Security & deployment notes (fold into the self-hosted model)
- Bridge lives **inside** the MailStash trust boundary (same box that already stores decrypted Gmail/IMAP mail) — consistent, not new exposure, **for self-hosting**.
- Proton credentials + bridge passwords use the same encrypted-at-rest treatment as IMAP creds (audit that this exists / harden it).
- Ship the bridge as a **compose service / sidecar** in the prod Docker setup; `bridge-manager.ts` talks to it over loopback.
- **Fragility to accept** (from feasibility doc): bridges ride Proton's private API and can break on Proton changes; hydroxide IMAP is WIP. Wire bridge health into the notification capability so breakage surfaces as a normal "account needs attention," not silent failure.

---

# Suggested build order (ties both parts together)

0. **API-helper layer (#4)** — prerequisite; don't expose mobile endpoints on the current hand-rolled routes.
1. **Provider interface refactor** — collapse Gmail/IMAP behind `EmailProviderClient` (also clears review S1/#5).
2. **Mobile read API** — accounts/folders/threads/body/search over the existing sync store (Gmail+IMAP), thread-first (#10, #8).
3. **Delta sync + APNs** — including the shared problem-notification path (#7).
4. **Proton provider** — `bridge-manager` + `proton-client` behind the interface from step 1; hydroxide spike gates the binary choice.
5. **Compose/send** — new `SendService` + `nodemailer`/Gmail-API/bridge-SMTP; `POST /outbox`.
6. **iOS app** — SwiftUI thin client consuming steps 2–5.
7. **Spark-parity polish** — snooze, send-later, smart inbox, swipe actions.

Proton (step 4) is deliberately *after* the interface refactor and read API, so it drops in as "a third provider" rather than a special case — which is the whole reason the bundled-bridge approach is tractable.
