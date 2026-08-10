# Feasibility Spike: iOS Mail Client (Spark-like) with Proton + MailStash features

_Date: 2026-08-09. Purpose: answer the single highest-risk unknown before any building — **can an iOS app legitimately access Proton Mail?** — and frame the overall effort._

## TL;DR

- **In a self-hosted archiver, Proton access is a solved-enough problem — not a blocker.** The right framing is: the iOS app never talks to Proton directly. A **server-side bridge decrypts and exposes Proton over IMAP**, MailStash's existing IMAP engine ingests it, and the app talks to MailStash over HTTPS. For a self-hosted tool, the server holding decrypted mail is expected (same trust boundary as the Gmail/IMAP mail MailStash already stores), not a liability.
- **Two server-side bridge options:**
  - **Proton Mail Bridge** — official, but **desktop-only** and **GPLv3**; running it headless on a server is a community hack.
  - **[hydroxide](https://codeberg.org/emersion/hydroxide)** — **headless, MIT-licensed**, talks to Proton **directly** (no official Bridge needed), exposes **IMAP/SMTP/CardDAV**. This is the better fit for a self-hosted server and removes both the desktop-only and GPLv3 problems.
- **Remaining Proton risk is _fragility_, not _impossibility_.** Both bridges rely on Proton's **private, reverse-engineered API** (no public API exists). hydroxide is "casually maintained" and its **IMAP support is work-in-progress / unencrypted-local-only** — fine for periodic archiver pulls, shakier for a live IDLE-push client experience. Proton can change internals and break it. So it's a dependency-durability risk to accept, not a wall.
- **Sending** from Proton also works through these bridges (SMTP); on Proton **Business** plans, **SMTP submission tokens** are an official send-only path.
- **Verdict: Proton is no longer the thing that sinks this.** With a self-hosted headless bridge (hydroxide), Proton becomes "just another IMAP account" to MailStash. The real cost of the project is the **iOS-client build itself** (compose/send, native app, push, Spark-parity UX — all new), which the bridge does nothing to reduce.

---

## The core question: Proton access from iOS

### What Proton offers
| Path | Reading | Sending | Where it runs | Plan | Notes |
|---|---|---|---|---|---|
| **hydroxide** (3rd-party) | ✅ IMAP (WIP) | ✅ SMTP | **Any server, headless** | Any | MIT; talks to Proton's private API directly; casually maintained |
| **Proton Bridge** (official) | ✅ IMAP (localhost:1143) | ✅ SMTP (localhost:1025) | **Desktop only** — Win/Mac/Linux | Paid personal+ | GPLv3; headless-on-server is a community hack |
| **SMTP submission token** | ❌ | ✅ send-only | Any server/app | **Business only** | Official send-only path |
| **Public API** | ❌ none | ❌ none | — | — | Does not exist |
| **Official mobile apps** | ✅ | ✅ | Proton's own iOS/Android app | Any | Not usable by a third-party client |

Sources: [Proton IMAP/SMTP setup](https://proton.me/support/imap-smtp-and-pop3-setup), [Proton Mail Bridge](https://proton.me/mail/bridge), [SMTP submission](https://proton.me/support/smtp-submission), [Proton on iOS](https://proton.me/support/mail-ios).

### The right architecture: a server-side bridge, never direct-from-iOS
The iOS app should **never talk to Proton directly** — no third-party mobile app can. Instead:

```
Proton  ──►  hydroxide (headless, on your server)  ──►  IMAP  ──►  MailStash sync engine  ──►  HTTPS  ──►  iOS app
                     (decrypts here)                                  (stores .eml, as today)
```

This is the same shape MailStash already uses for Gmail/IMAP: a server pulls mail, decrypts/parses, stores it, and serves it over HTTPS. Proton just becomes another IMAP source behind hydroxide. For a **self-hosted** tool this is expected and correct — the "server holds decrypted mail" concern only bites in a **multi-tenant product** where you'd be custodian of *other people's* Proton mail.

### Risks to accept (fragility, not impossibility)
- **Unofficial, reverse-engineered API.** hydroxide (and Proton Bridge) translate protocols into Proton's **private API** — there is no public one. Proton can change internals and break the bridge. This is a real dependency-durability risk for something you use daily.
- **hydroxide maturity.** IMAP support is **work-in-progress** and **unencrypted-local-only**, and the project is "casually maintained." Fine for an **archiver** doing periodic pulls; weaker for a **live client** wanting IMAP IDLE push and snappy folder ops. Mitigate by keeping the bridge on localhost / a private network and not exposing its unencrypted IMAP port.
- **E2E trust boundary moves to your server.** Decryption happens in hydroxide on your box. Acceptable (and the point) for self-hosting; a blocker for a hosted product.
- **Alternative bridge = Proton Bridge**, if hydroxide proves too flaky — but it's desktop-only (headless-on-server is a hack) and **GPLv3**. hydroxide's MIT license + headless design make it the better default.

**Conclusion on Proton:** **not a blocker for a self-hosted archiver.** Via a headless bridge (hydroxide preferred, Proton Bridge as fallback) Proton is "just another IMAP account." The residual risk is the bridge's fragility/maturity, which is a maintenance concern to accept — not a wall. Proton would only be a genuine blocker for a **multi-tenant hosted product**, which is not the model here.

---

## The rest of the effort (assuming Proton is solved or dropped)

Even setting Proton aside, "clone Spark + MailStash featureset on iOS" is a **multi-month product build**, not a feature. What exists today (`mailstash`) is a **Next.js email *archiver*** — it reads Gmail/IMAP, stores `.eml`, does auto-delete. It is **not** a mail-client backend.

### What the current codebase gives us (the head start)
- Gmail (OAuth) + IMAP sync engine (`lib/email/`, `lib/services/sync/`).
- Email storage + parsing (`.eml`, mailparser).
- Auto-delete / retention (a genuinely differentiated MailStash feature).
- Account/job model and (soon) a notification capability.

### What's missing for a *mail client* (all new)
- **Sending / compose** — the app has **no SMTP/compose path at all** today. A client is fundamentally a sending app.
- **Native iOS app** — SwiftUI app, offline store, sync engine on-device or a mobile-tuned backend API. The current Next.js app is a server/web UI, not a mobile backend.
- **Real-time push (APNs)** — needs an always-on backend holding IMAP IDLE / Gmail `watch` per account and pushing via APNs. None of this exists.
- **Spark-parity UX** — unified inbox, swipe actions, snooze, send-later, smart inbox, threading, search, attachments, signatures. Cloning "the feel" is the hard majority of the work and is years of Spark's refinement.
- **Gmail OAuth production verification** — the same restricted-scope verification wall as issue #6, now with a published iOS app under Apple review too.
- **Multi-provider auth/session management**, contacts, calendar hooks (Spark has these), etc.

---

## Tooling: what you can get off-the-shelf (and the decision that determines it)

MailStash didn't roll its own IMAP — it uses `imapflow` (IMAP), `mailparser` (MIME), `googleapis` (Gmail). The natural question is the iOS equivalent. **The answer hinges on one architecture choice**, because it decides whether you need an on-device mail stack at all:

### Architecture A — "thin client" (recommended): backend does the mail, app is UI
The iOS app never speaks IMAP/SMTP. **MailStash's existing Node stack** (imapflow + mailparser + googleapis + hydroxide-for-Proton) stays the mail engine, exposes a clean JSON/HTTP API, and the app is a SwiftUI client over that API. New mail arrives via **APNs** (backend detects it, pushes).

Why this is the right default here:
- **You already have the hard part.** The sync engine, parsing, storage, retention, multi-provider auth all exist server-side in a language with *mature, maintained* mail libraries. You'd be extending it, not rebuilding it in Swift.
- **iOS fights on-device IMAP.** iOS won't let apps hold persistent background connections (battery/network), so **IMAP IDLE on-device doesn't work for push** — you need a server + APNs regardless. That server is exactly MailStash. ([APNs design](https://en.wikipedia.org/wiki/Apple_Push_Notification_service), [IDLE limitations](https://docker-mailserver.github.io/docker-mailserver/latest/examples/use-cases/ios-mail-push-support/))
- **Proton fits cleanly** — hydroxide already lives server-side in this model.

What you build on iOS: SwiftUI + a local cache (SwiftData/GRDB/Realm) + a networking layer + APNs handling. All of that has first-class, off-the-shelf tooling. This is "a well-built API client app," not "a mail client from scratch."

### Architecture B — "fat client": the app speaks IMAP/SMTP itself
If you wanted the app to talk to servers directly (offline-first, no backend dependency), you'd need an on-device mail stack. **Here the tooling is genuinely thin in 2026:**

| Option | State | Verdict |
|---|---|---|
| **MailCore2** (ObjC/C++, the historical default) | **Last real update ~2020; build issues on modern Xcode; effectively unmaintained** | Risky to depend on |
| **SwiftMail** (Swift, on SwiftNIO) | New (Mar 2025), pure-Swift IMAP+SMTP, but **early-stage, "built in under a week," protocol primitives only** — no sync engine, no IDLE mentioned | Promising, not production-proven |
| **swift-nio-imap** (Apple) | Solid IMAP4rev1 parser on SwiftNIO, but **low-level; no SMTP; "significant work" to make usable** | A building block, not a library |
| MIME parsing | Various Swift MIME parsers, none dominant | Piecemeal |

So Architecture B means betting on an immature library (SwiftMail) or wrapping an unmaintained one (MailCore2) or building substantial glue over SwiftNIO — **and you still need a backend + APNs for push anyway.** That's the worst of both worlds for this project.

Sources: [MailCore2 status](https://swiftpackageindex.com/MailCore/mailcore2), [SwiftMail intro](https://www.cocoanetics.com/2025/03/introducing-swiftmail/), [swift-nio-imap](https://github.com/apple/swift-nio-imap).

### Managed shortcut (worth knowing): unified email APIs
If you didn't already have a sync engine, **hosted unified-email APIs** (Nylas, Aurinko, Unipile) normalize Gmail/IMAP/Microsoft into one JSON API with sync + webhooks, cutting months of backend work. **But**: they cost per-account, add a third party in the mail path (privacy tension with a MailStash-style archiver), and **don't cover Proton**. Since you *already* own the sync engine, these are more "good to know" than "reach for" — relevant only if you'd rather not extend MailStash's backend.

### Bottom line on tooling
There is **no drop-in "email client SDK" for iOS** the way MailCore2 once felt like one — that era has largely lapsed. The leverage is in **Architecture A**: reuse MailStash's proven Node mail stack as the backend, and the iOS side becomes ordinary (well-supported) app work — SwiftUI, a local store, networking, APNs. Don't put IMAP on the phone.

---

## Recommendation

1. **The pivot is _audience_, but not because of Proton.** For a **self-hosted** tool (personal, or self-hosted-per-user), Proton via hydroxide is fine. Proton only becomes a real blocker for a **multi-tenant hosted product** (custodian of others' decrypted mail). So decide: self-hosted archiver-with-a-client (green light on Proton) vs. hosted product (ship Gmail/IMAP-first, Proton as advanced BYO-bridge).

2. **De-risk hydroxide with a throwaway spike** before committing — this is now a *maturity* check, not a *possibility* check: run hydroxide headless in a container, `hydroxide auth`, point MailStash's existing IMAP sync at its local IMAP port, and confirm a full + incremental pull of a real Proton account works and stays working over a few days. If hydroxide's WIP IMAP is too flaky, fall back to headless Proton Bridge; if neither is reliable enough, Proton drops to "someday." Cheap to find out.

3. **Sequence the real build** (if going ahead), each a checkpoint. Note Proton moves *early* now — it's a normal IMAP source, so it can ride Phase 1:
   - **Phase 0** — hydroxide spike (maturity/reliability check, not go/no-go).
   - **Phase 1** — Backend mobile API over the existing sync engine (read-only unified inbox: Gmail + IMAP **+ Proton-via-hydroxide**).
   - **Phase 2** — Native iOS shell consuming it; core list/thread/read UX.
   - **Phase 3** — Compose/send (new SMTP path — routes to Gmail/IMAP/hydroxide SMTP per account) + APNs push.
   - **Phase 4** — MailStash differentiators (archive/retention) surfaced in-app.
   - **Phase 5** — Spark-parity polish (snooze, send-later, smart inbox, swipe actions).

4. **Don't block the MailStash notification work on any of this.** The general problem-notification capability (in-app first) is valuable now and its server-side logic is reused by any future client. Keep shipping it.

---

## One-line answer to "is it possible?"
**Yes — as a self-hosted archiver-plus-client, Proton included.** A headless bridge (hydroxide, MIT, or Proton Bridge as fallback) turns Proton into just another IMAP source for MailStash's existing engine, so the E2E/decryption concern is a non-issue for self-hosting. **Proton is no longer the blocker; the multi-month iOS-client build (compose/send, native app, push, Spark-parity UX) is the actual cost.** Proton would only be a genuine wall for a **multi-tenant hosted product**, which isn't the model here.

## Sources
- [Proton — IMAP, SMTP, POP3 setup](https://proton.me/support/imap-smtp-and-pop3-setup)
- [Proton Mail Bridge](https://proton.me/mail/bridge)
- [Proton — SMTP submission (Business, send-only)](https://proton.me/support/smtp-submission)
- [Proton — Using Proton Mail on iOS](https://proton.me/support/mail-ios)
- [Community: Proton Bridge + Tailscale into iOS Mail (unofficial)](https://rossjr.dev/blog/proton-bridge-tailscale/)
- [Unofficial ProtonMail API documentation project](https://github.com/secure-mail-documentation-project/protonmail-api)
- [hydroxide — headless, MIT-licensed third-party Proton bridge (IMAP/SMTP/CardDAV)](https://codeberg.org/emersion/hydroxide)
