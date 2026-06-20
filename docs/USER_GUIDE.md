# TID — User Guide

**Version:** 2.0.0
**Author:** Sayan Pramanick
**Copyright:** © 2026 Sayan Pramanick. All rights reserved.

A step-by-step guide to using the TID (Task & Investment Decision) workspace.

---

## Table of contents

1. Getting started — register and sign in
2. Tour of the workspace
3. Goals — create, track, and complete
4. Tasks — capture and clear what's on your plate
5. Notes — quick thoughts and lists
6. Calendar — see everything by date
7. Investments — your portfolio
8. AI Co-pilot — daily briefings and quick-create
9. Theme — light vs dark
10. Admin tools (admin accounts only)
11. Frequently asked questions

---

## 1. Getting started

### 1.1 Open the app
Browse to the URL where TID is hosted. You'll see the welcome screen with a Sign in / Create account toggle on the right.

### 1.2 Demo accounts (for first-time exploration)
- Username: `demo` · Password: `Demo@123` — standard user with seed data
- Username: `admin` · Password: `Admin@123` — admin (sees all data, has the Admin Console)

Click "Use demo" if a button is shown, or just type the credentials yourself.

### 1.3 Create your own account
1. Click **Create account** on the right card
2. Enter your email, a 10-digit phone number, and a password (8+ characters with letters and numbers)
3. Click **Create account**
4. Switch back to **Sign in**, enter your username (the part before `@` in your email) and password
5. Click **Sign in** — the dashboard opens

---

## 2. Tour of the workspace

After signing in you land on **Goals**. The sidebar on the left lists every section in order:

1. **Goals** — outcome tracking with progress rings
2. **Tasks** — your day-to-day to-do list
3. **Notes** — sticky notes for ideas
4. **Calendar** — month view with everything plotted
5. **Investments** — portfolio tracking
6. **Admin Console** — only visible if you're an admin

Each row shows a live count next to the icon (e.g. `Tasks 4`).

The **collapse handle** sits on the seam between sidebar and main column — click it to shrink the sidebar to icons only.

The **AI Co-pilot** button floats in the bottom-right corner. Click it any time for a status check.

---

## 3. Goals — create, track, and complete

### 3.1 Create a goal
1. Open the **Goals** tab
2. Click **+ New goal** in the top-right
3. Fill in the editor:
   - **Title** — what you want to achieve
   - **Description** — why and how (optional)
   - **Category** — Health / Learning / Finance / Career / Personal / Habit (sets the color tone)
   - **Target value** — the number you're aiming for (e.g. `300000`, `12`, `52`)
   - **Current value** — starting point (defaults to 0)
   - **Unit** — free-text label like `₹`, `books`, `weeks`, `kg` (optional)
   - **Start / Due dates** — pick from the date picker
   - **Status** — In progress / Completed / Paused
   - **Milestones** — type a label, press `+`, repeat. Each milestone has a check button you can toggle anytime
4. Click **Create goal**

### 3.2 Track progress
On any goal card:
- The **ring** shows percent complete
- The **`+` button** bumps current value by 1 (auto-completes the goal when you hit target)
- The **`-` button** rolls progress back by 1
- Click any **milestone** to toggle it done/undone (strikethrough animation)
- The **Pause / Resume** button on the card freezes / unfreezes a goal

### 3.3 Edit or delete
- Click anywhere on the card to open the editor
- The trash icon on the card opens a confirmation dialog

### 3.4 Filter and search
Use the toolbar above the goal grid:
- **Search** — title and description
- **Status** filter — All / In progress / Completed / Paused
- **Category** filter — narrow to a single category

---

## 4. Tasks — capture and clear what's on your plate

### 4.1 Create a task
1. Open the **Tasks** tab
2. Click **Add Task** in the top-right
3. Fill in:
   - **Subject** — short title
   - **Description** — context
   - **Priority** — Low / Medium / High
   - **Start date / End date** — pickable with the date+time picker
   - **Reminder** — toggle on if you want the AI Co-pilot to nudge you
   - **Status** — Not started / Partially completed / Completed
   - **Subtasks** — optional checklist items
4. Click **Create task**

### 4.2 Edit, view, delete
Each row in the task table has icons:
- **Eye** → view-only mode
- **Pencil** → edit
- **Trash** → confirmation dialog

### 4.3 Filter
The status segmented control on the left lets you flip between All / Not started / Partially / Completed / Overdue.

### 4.4 Day-to-day strip
Above the table you'll find a 7-day strip showing today plus the next six days. Click any day to see only its tasks.

### 4.5 Quick-create with the AI
Open the AI Co-pilot panel and type:
```
task: review portfolio !high @tomorrow
```
This creates a task instantly with priority and due date set.

---

## 5. Notes — quick thoughts and lists

### 5.1 Create a note
1. Open the **Notes** tab
2. Click **+ New note**
3. Fill in:
   - **Title** (optional)
   - **Body** — supports line breaks
   - **Tags** — comma-separated (`research, finance`)
   - **Color** — pick from the swatch row
   - **Pin** — toggle to keep this note at the top
4. Click **Create note**

### 5.2 Pin / unpin
Hover over any note card and click the thumbtack icon. Pinned notes appear in their own section at the top of the page.

### 5.3 Delete
Hover over a card and click the trash icon. A confirmation dialog appears.

### 5.4 Search and filter
- The search box scans titles, body text, and tags
- The color dropdown filters by sticky-note color

### 5.5 Quick-create with the AI
```
note: Title | body text
```
The `|` separates title from body. Either side can be empty.

---

## 6. Calendar — see everything by date

The Calendar tab gives you a Google-style month view with task chips on each day cell.

- **Prev / Next** arrows shift the month
- **Today** button jumps back to the current month
- Click any day to open a side panel with everything scheduled
- Click a chip to drill into the task
- The **+** button on the calendar nav adds a task pre-filled to that day

---

## 7. Investments — your portfolio

### 7.1 Add an investment
1. Open the **Investments** tab
2. Click **+ Add Investment**
3. Fill in:
   - **Name** — e.g. "HDFC Bank FD"
   - **Type** — Stock / Mutual Fund / Fixed Deposit / Bond / Real Estate / Crypto / Other
   - **Amount** — what you invested
   - **Current value** — current market value
   - **Start date** — when you bought / opened
   - **Maturity date** — for FDs and Bonds (optional)
   - **Risk** — Low / Medium / High
   - **Status** — Active / Matured / Sold
   - **Notes** — anything you want to remember
4. Click **Create**

### 7.2 KPIs and charts
The top of the page shows:
- Total invested
- Current portfolio value
- Total gain / loss in absolute and percentage
- Allocation pie chart (by type)
- Per-investment performance bars

### 7.3 Edit, view, delete
Same row icons as tasks (eye / pencil / trash with confirmation dialog).

---

## 8. AI Co-pilot — daily briefings and quick-create

### 8.1 Open the panel
Click the floating orb in the bottom-right corner. It shows pending count if you have urgent items.

### 8.2 Daily briefing
Click the **sun** icon in the panel header for a one-shot summary across all domains. Once a day, the briefing also fires automatically on first scan if "Daily briefing" is enabled in settings.

### 8.3 Quick-create commands
Type any of these in the composer:
```
task: review portfolio !high @tomorrow
note: Title | body text
goal: Save for laptop target 80000 ₹
```

Inline modifiers for tasks:
- **Priority**: `!high`, `!medium`, `!low`
- **Due date**: `@today`, `@tomorrow`, `@2026-06-30`

### 8.4 Suggestions
The Co-pilot surfaces nudges across:
- Overdue tasks
- Tasks due today
- High-priority open tasks
- Stalled work-in-progress (3+ days)
- Goals at risk (behind pace)
- Goals close to finishing (≥80%)
- Investments maturing in 30 days
- Investments down 10%+

Each suggestion has a **CTA button** (Mark done / Mark in progress / Bump +1 / View) and a **snooze button** (bed icon) that dismisses it until tomorrow.

### 8.5 Streak
Complete a task today and the Co-pilot starts counting. The flame chip in the snapshot bar shows your consecutive days. Don't break the chain.

### 8.6 Chat naturally
The Co-pilot recognizes greetings, thanks, motivation prompts, and questions like:
- "what's due today"
- "show overdue"
- "how are my goals"
- "portfolio update"
- "brief me"

### 8.7 Settings
Click the gear icon in the panel header to control:
- **Auto-scan** — on/off
- **Interval** — 15m / 30m / 60m
- **Daily briefing** — once-per-day summary on/off

### 8.8 Clear chat
The trash icon next to the gear clears your chat history. The background scan keeps running.

---

## 9. Theme — light vs dark

The theme toggle is in the sidebar's Account section (or in the mobile topbar on phones).
- **Light** — bright, professional surfaces, good for daytime
- **Dark** — default, lower-strain, plasma-friendly

Your choice persists across sessions.

---

## 10. Admin tools

If your role is `admin`, an extra **Admin Console** entry appears in the sidebar.

### 10.1 User directory
Search by name or email. Per-user actions:
- **Promote / Demote** — toggle role between admin and user
- **Remove** — deletes the account and cascades through their tasks, investments, notes, and goals

### 10.2 Reset data picker
Click **Reset data…** in the top-right. Choose:

#### Wipe a user's data
1. Click the warning option
2. Search for the user in the picker
3. Click their row — confirmation dialog appears with full breakdown
4. Login credentials stay intact; only their tasks, investments, notes, and goals are wiped

#### Reset everything
1. Click the danger option
2. Type `RESET` exactly to enable the confirm button
3. Click confirm — all data wipes back to seed state, your session ends

---

## 11. Frequently asked questions

### Where is my data stored?
Locally in your browser's localStorage, encrypted with AES-256-GCM. Only this device has the data.

### Will my data sync across devices?
No. TID is a frontend-only app — there's no server.

### What happens if I clear my browser cache?
Everything is gone. Export anything important before clearing.

### Are passwords secure?
Yes — they're hashed with PBKDF2-SHA-256 (200,000 iterations) before storage. The plain password never touches disk.

### Can I export my data?
Not yet through the UI. Tasks, goals, notes, and investments are stored in encrypted localStorage entries; future versions may add an export button.

### How do I report a bug?
Contact the developer, **Sayan Pramanick**.

---

> **End of guide.** Need a refresher? Open this guide any time from **Sidebar → Help**.
