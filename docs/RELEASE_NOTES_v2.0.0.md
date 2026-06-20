# TID v2.0.0 — Release Notes

**Release name:** v2 · Goals, Notes & Co-pilot
**Release date:** 2026-06-20
**Maintainer / Developer:** Sayan Pramanick

> Copyright © 2026 Sayan Pramanick. All rights reserved.

---

## Highlights

- Brand-new **Goals** module with progress rings, milestones, and per-category color tones
- Brand-new **Notes** module with sticky-note board UI, color tags, and pin-to-top
- **AI Co-pilot** rebuilt — multi-domain awareness (tasks, goals, investments, notes), daily briefing, productivity streak, quick-create commands, snooze
- **World-class confirm dialog** replaces every native `window.confirm` / `alert`
- **PASETO v3.local** session tokens, **AES-256-GCM** encrypted storage, **PBKDF2-SHA-256** password hashing, login throttling
- Light-mode polish across surfaces; world-class responsive layout
- Cleaner button system applied app-wide
- Help section with downloadable User Guide

---

## What's new

### Goals (new module)
- Six categories — Health, Learning, Finance, Career, Personal, Habit — each with a unique color tone
- Animated SVG progress ring per goal
- Milestones list with click-to-toggle done/undone
- Quick `+` / `-` bump buttons on each goal card for one-tap progress updates
- Auto-completes a goal when current value reaches the target
- Status chips: In progress (pulsing dot), Completed, Paused
- Due-date awareness: "12 days left" / "3 days overdue" / "Done Mar 14"
- Editor with category dropdown, target/current/unit triple, start + due dates, milestone editor

### Notes (new module)
- Seven-color sticky-note palette
- Pinned section rendered separately above all others
- Hover-revealed pin / delete actions on each card
- Search across title, body, and tags + color filter
- KPI strip showing total notes, pinned count, unique tag count
- Editor modal with title, body, comma-separated tags, color swatches, pin toggle

### AI Co-pilot (significant upgrade)
- **Multi-domain scan** — tasks, goals, investments, and notes in a single forkJoin
- **Suggestions** for: overdue tasks, due today, high-priority open, stalled WIP, goals at risk, goals close to done, investments maturing soon, investments down 10%+
- **Daily briefing** — once-a-day summary across all domains, on demand or automatic
- **Quick-create** from the chat composer:
  - `task: review portfolio !high @tomorrow`
  - `note: Title | body text`
  - `goal: Save for laptop target 80000 ₹`
- **Snooze** — dismiss any suggestion until tomorrow
- **Productivity streak** — consecutive days with at least one completed task
- **Bump-goal action** — `+` button on goal suggestions increments progress
- **Time-of-day greeting** + first-name personalization
- **Small-talk recognition** — greetings, thanks, motivation prompts
- **Snapshot chips** for goals at risk, goals close, investments maturing, big losers, streak
- Quick prompts updated: Brief me, Due today, Overdue, Goals, Portfolio, Streak, Scan now
- Memory-leak safe: tracked timers, takeUntil(destroy$) everywhere, visibility-pause for polling, full reset on logout

### Confirm dialog
- Tone presets: danger / warning / info / success
- Optional "type to confirm" mode (e.g. type `RESET`)
- Eyebrow + title + body + optional bullet details
- Bottom-sheet behavior on mobile
- Esc dismisses, Enter confirms, backdrop click cancels
- Auto-focuses Cancel for danger tones (safer)
- Reduced-motion support
- Replaces every `window.confirm` and `alert` across the app

### Admin reset experience
- Top-right "Reset data…" opens a scope picker
- Two clearly distinct options:
  - **Wipe a user's data** → opens an in-modal user picker with per-user counts
  - **Reset everything** → type-to-confirm, ends session
- Per-user wipe leaves login credentials intact (Remove account is a separate row action)
- User remove cascades through tasks, investments, notes, and goals

### Security stack
- **PASETO v3.local** authenticated tokens (HMAC-SHA-384 verify-before-decrypt)
- **AES-256-GCM** encrypted localStorage with key bound as AAD per storage key
- **PBKDF2-SHA-256** password hashing with 200,000 iterations and per-user salt
- **Login throttling** with exponential backoff (3 fails = 10s, escalating to 15min cap)
- **HKDF-SHA-384** subkey derivation per PASETO spec
- **Constant-time tag comparison** for HMAC verify
- Production builds: `sourceMap: false`, `namedChunks: false`
- Defense-in-depth meta tags: X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Session token TTL 30 minutes with auto-logout
- See `src/app/services/security/` for the full implementation

> **Honest note**: in a frontend-only app, anyone with full device access can still read the device key from localStorage. This is a fundamental property of running auth in the browser. Real-world auth requires a backend.

### UI / UX polish
- Global button system: primary, ghost, cancel, danger, row-btn, icon-btn — consistent shape, alignment, focus rings, disabled states
- Light-mode rework — deeper shadows, gradient surfaces, plasma-bg recoloring, sidebar lift, frosted mobile topbar
- Login page redesigned with gold-icon feature cards mirroring a professional landing-page mockup
- Plasma background animation across the app shell (excluded from login page)
- Responsive scaffolding for fluid type, fluid spacing, touch-target enforcement, and form-grid collapse on phones
- Sidebar order: Goals → Tasks → Notes → Calendar → Investments → Admin Console
- Sidebar badges show live counts for each module

### Help section (new)
- Reachable from the Account section in the sidebar
- Shows app version, release name, copyright
- Step-by-step User Guide HTML viewable in the browser, printable, and "Save as PDF" friendly
- Release Notes HTML viewable in the browser

---

## Breaking changes

- Storage seed key bumped from `tid.seeded.v2` to `tid.seeded.v3`. Existing installs retain their tasks/investments and have notes/goals seeded automatically (backfill is non-destructive)
- Auth tokens are now PASETO v3.local — older `tid.token` plain-JWT tokens are ignored on boot, prompting a fresh login

---

## Removed

- Native browser `confirm()` / `alert()` (replaced everywhere with custom dialog)
- Bare `<ngx-spinner>` markup in components (centralized via `LoaderService`)
- `Scan now` icon in the Assistant header (use the chip below the feed instead)

---

## Known limitations

- Frontend-only — no server-side enforcement, no multi-device sync
- Encrypted storage protects against casual inspection and tampering, not a determined operator with devtools
- CSP enforced via `<meta>` was removed because it broke Font Awesome webfonts in dev. Reference policy is documented in `index.html` for HTTP-header use at deploy time

---

## Migration

No user action required. On first launch after upgrade:
- Notes and Goals will be seeded with demo content (only on the demo account)
- Existing token will be silently rejected; users are returned to the login screen
- All existing tasks and investments remain intact and are migrated to encrypted storage

---

## Contributors

Developed by **Sayan Pramanick**.
