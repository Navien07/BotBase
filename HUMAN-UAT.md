# IceBot — Human UAT Guide

**Test Environment:** https://icebot-sandy.vercel.app
**Super Admin credentials:** navien@icebergaisolutions.com / _(ask team for password)_
**Date:** April 2026
**Prepared by:** Iceberg AI Solutions

---

## Pre-conditions

- Supabase project `kyywrzctcoocbozbnsqc` (Singapore) is running and accessible
- At least one tenant invite has been sent (or create one during UAT)
- At least one bot exists (create during UAT if not)
- Test device has a modern browser (Chrome/Edge recommended)
- Optional: a simple HTML file ready to test the web widget embed

---

## Test Sections

---

### 1. Authentication

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1 | Navigate to `https://icebot-sandy.vercel.app` | Redirects to `/login` |
| 1.2 | Enter super admin email + password, click **Sign In** | Redirects to `/dashboard/overview` |
| 1.3 | While logged in, navigate directly to `/login` | Redirects to `/dashboard/overview` |
| 1.4 | Click avatar dropdown (top-right) → **Sign Out** | Redirected to `/login`, session cleared |
| 1.5 | Without logging in, navigate to `/dashboard/overview` | Redirects to `/login` |
| 1.6 | Navigate to `/dashboard/bots` without session | Redirects to `/login` |

---

### 2. Onboarding Wizard (New Tenant Flow)

> Access via `/onboarding/create-bot` or by accepting an invite link.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1 | Navigate to `/onboarding/create-bot` | Step 1 form loads: bot name, industry, language, personality fields |
| 2.2 | Fill in bot name, select industry and language, choose personality, click **Next** | Advances to Step 2 |
| 2.3 | Step 2: drag-and-drop a PDF file onto the upload zone | File appears in list with "pending" status |
| 2.4 | Click **Skip** on Step 2 without uploading | Advances to Step 3 |
| 2.5 | Step 3: system prompt text area is editable; click **Regenerate** | Prompt regenerates with a loader, new text appears |
| 2.6 | Click **Next** to Step 4 (Connect Channel) | Step 4 loads with channel options |
| 2.7 | Click **Skip** on Step 4 | Advances to Step 5 |
| 2.8 | Step 5: type a message in the test chat → bot replies | Response appears in chat UI |
| 2.9 | Click **Go Live** | Confetti animation fires; redirects to `/dashboard/overview` |

---

### 3. Bot Management

| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1 | Navigate to `/dashboard/bots` | Bot list renders; "Create Bot" button visible |
| 3.2 | Click **Create Bot**, fill in name + industry, submit | New bot appears in list |
| 3.3 | Click the bot name / **Edit** | Bot settings form opens |
| 3.4 | Change bot name, click **Save** | Success toast; name updates in list |
| 3.5 | Toggle bot active/inactive switch | Toggle flips; status badge changes accordingly |
| 3.6 | Click bot switcher (top of sidebar) → select a different bot | Sidebar context changes; URL updates to new botId |
| 3.7 | With bot selected, sidebar shows all bot-scoped nav items | Conversations, Contacts, Broadcasts, Follow-ups, Knowledge, FAQs, Personality, Guardrails, Templates, Booking, Channels, Web Widget, Integrations, Testing Console, API Keys, Settings all visible |

---

### 4. Knowledge Base

| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1 | Navigate to `/dashboard/bots/[botId]/knowledge` | Knowledge Base page loads; upload button visible |
| 4.2 | Click **Upload Document** → select a PDF | Document appears in list with status **pending** |
| 4.3 | Wait ~30 seconds or trigger processing | Status changes: `pending → processing → ready` |
| 4.4 | Navigate to Testing Console (`/dashboard/bots/[botId]/testing`) | Test console loads |
| 4.5 | Ask a question that should match content in the uploaded PDF | Bot responds with relevant answer; debug panel shows RAG chunks used |

---

### 5. Conversations + Live Agent

| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1 | Navigate to `/dashboard/bots/[botId]/conversations` | Conversation list renders (may be empty if no sessions yet) |
| 5.2 | Click a conversation row | Message history panel opens on the right |
| 5.3 | In the detail panel, click **Assign to Agent** or agent name | Assignment updates; conversation shows assigned agent |
| 5.4 | Click **Mark Resolved** | Conversation status changes to resolved; moves out of active list |

---

### 6. Contacts (CRM)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1 | Navigate to `/dashboard/bots/[botId]/contacts` | Contacts table renders |
| 6.2 | Type a name or phone number in the **Search** box | Table filters results in real-time |
| 6.3 | Click a contact row | Contact detail panel/page opens |
| 6.4 | Contact detail shows conversation history | Previous messages visible |
| 6.5 | Click **Export CSV** | CSV file downloads to computer |

---

### 7. Channels

| Step | Action | Expected Result |
|------|--------|-----------------|
| 7.1 | Navigate to `/dashboard/bots/[botId]/channels` | Channel configuration page loads |
| 7.2 | WhatsApp section: enter a test token + Phone Number ID, click **Save** | Success toast; token stored (displayed masked as `••••xxxx`) |
| 7.3 | Telegram section: enter a bot token, click **Save** | Success toast; token stored masked |
| 7.4 | Navigate to `/dashboard/bots/[botId]/widget` | Web Widget page loads |
| 7.5 | Embed code snippet is visible; click **Copy** | Code copies to clipboard; success toast shows |

---

### 8. Bookings

| Step | Action | Expected Result |
|------|--------|-----------------|
| 8.1 | Navigate to `/dashboard/bots/[botId]/booking` | Booking configuration page loads |
| 8.2 | Configure facilities/slots (e.g. beds per location), click **Save** | Config saved; success toast |
| 8.3 | Navigate to bookings list tab | Booking list table renders (may be empty) |
| 8.4 | Click a booking row (if any exist) | Booking detail shows member info, facility, date/time, status |

---

### 9. Flow Builder

| Step | Action | Expected Result |
|------|--------|-----------------|
| 9.1 | Navigate to `/dashboard/bots/[botId]/scripts` | Flow Builder canvas loads (ReactFlow canvas visible) |
| 9.2 | Click **New Flow** or **Create Flow** | New flow is created; blank canvas shown |
| 9.3 | Add a node (e.g. drag from panel or click **Add Node**) | Node appears on canvas |
| 9.4 | Drag an edge from one node's handle to another node | Connection (edge) appears between nodes |
| 9.5 | Click **Save** | Success toast; flow is saved |

---

### 10. Broadcasts + Follow-ups

| Step | Action | Expected Result |
|------|--------|-----------------|
| 10.1 | Navigate to `/dashboard/bots/[botId]/broadcasts` | Broadcasts list renders; **Create Broadcast** button visible |
| 10.2 | Click **Create Broadcast** → enter a message, select audience, click **Save** | New broadcast appears in list with status `draft` |
| 10.3 | Navigate to `/dashboard/bots/[botId]/followups` | Follow-ups list renders; **Create Follow-up** button visible |
| 10.4 | Click **Create Follow-up** → configure message + delay, click **Save** | Follow-up sequence appears in list |

---

### 11. Analytics

| Step | Action | Expected Result |
|------|--------|-----------------|
| 11.1 | Navigate to `/dashboard/bots/[botId]/analytics` | Analytics page loads with charts (zero data is acceptable) |
| 11.2 | Change the date range picker (e.g. last 7 days → last 30 days) | Charts refresh with updated range |
| 11.3 | Click **Export CSV** | CSV file downloads; check it opens correctly |

---

### 12. Public Chat Widget

| Step | Action | Expected Result |
|------|--------|-----------------|
| 12.1 | Navigate to `/chat/[botId]` in a browser | Full-page chat interface loads |
| 12.2 | Type a message and press Enter | Bot responds in the chat |
| 12.3 | Create a simple HTML file locally: `<script src="https://icebot-sandy.vercel.app/widget.js" data-bot-id="[botId]"></script>` | Open in browser; floating chat bubble appears in bottom-right corner |
| 12.4 | Click the floating bubble | Chat drawer opens |
| 12.5 | Send a message | Bot replies; messages appear in drawer |

---

### 13. Testing Console

| Step | Action | Expected Result |
|------|--------|-----------------|
| 13.1 | Navigate to `/dashboard/bots/[botId]/testing` | Testing Console page loads with chat input |
| 13.2 | Send a test message | Bot responds; response appears in chat |
| 13.3 | Expand debug panel | Shows: detected intent, language, sentiment, RAG chunks retrieved, pipeline steps |
| 13.4 | Send a message matching a FAQ | Response uses FAQ content; debug shows FAQ match |

---

### 14. Super Admin — Tenants

> Must be logged in as `super_admin` role.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 14.1 | Navigate to `/dashboard/admin/tenants` | Tenant table renders; all tenants listed |
| 14.2 | Click **Suspend** on a tenant | Tenant status changes to "Suspended" |
| 14.3 | Click **Reactivate** on the same tenant | Status reverts to active |
| 14.4 | Click **Invite Admin** → enter an email address | Invite form accepts the email; submit sends invite |

---

### 15. Super Admin — All Bots Monitor

| Step | Action | Expected Result |
|------|--------|-----------------|
| 15.1 | Navigate to `/dashboard/admin/bots` | Table shows all bots across all tenants |
| 15.2 | Check error rate column | Displays green (low) or red (high) indicator per bot |
| 15.3 | Click a bot row | Navigates to that bot's conversations view |

---

### 16. Super Admin — Users

| Step | Action | Expected Result |
|------|--------|-----------------|
| 16.1 | Navigate to `/dashboard/admin/users` | Users table shows all accounts |
| 16.2 | Locate a user; click the **Role** dropdown | Dropdown shows available roles (tenant_admin, agent) |
| 16.3 | Change the role, click **Save** | Role updates; success toast shown |

---

### 17. Super Admin — Billing / Usage

| Step | Action | Expected Result |
|------|--------|-----------------|
| 17.1 | Navigate to `/dashboard/admin/billing` | Usage table renders; per-tenant stats visible |
| 17.2 | Click **Export CSV** | CSV downloads with usage data |

---

### 18. Mobile Responsiveness

> Resize browser to 375px width (or use DevTools device emulation).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 18.1 | Load `/dashboard/overview` at 375px | Sidebar is hidden; hamburger menu icon visible top-left |
| 18.2 | Tap the hamburger icon | Sidebar drawer slides open from the left |
| 18.3 | Tap outside the drawer | Drawer closes |
| 18.4 | Tap a nav item | Drawer closes; correct page loads |
| 18.5 | Open a table page (e.g. Contacts) at 375px | Table scrolls horizontally without breaking layout |
| 18.6 | Open the Testing Console at 375px | Chat input and response area usable on mobile |

---

## Pass/Fail Tracker

| # | Feature | Status | Tester | Notes |
|---|---------|--------|--------|-------|
| 1 | Authentication | ⬜ | | |
| 2 | Onboarding Wizard | ⬜ | | |
| 3 | Bot Management | ⬜ | | |
| 4 | Knowledge Base | ⬜ | | |
| 5 | Conversations + Live Agent | ⬜ | | |
| 6 | Contacts (CRM) | ⬜ | | |
| 7 | Channels | ⬜ | | |
| 8 | Bookings | ⬜ | | |
| 9 | Flow Builder | ⬜ | | |
| 10 | Broadcasts + Follow-ups | ⬜ | | |
| 11 | Analytics | ⬜ | | |
| 12 | Public Chat Widget | ⬜ | | |
| 13 | Testing Console | ⬜ | | |
| 14 | Super Admin — Tenants | ⬜ | | |
| 15 | Super Admin — All Bots | ⬜ | | |
| 16 | Super Admin — Users | ⬜ | | |
| 17 | Super Admin — Billing | ⬜ | | |
| 18 | Mobile Responsiveness | ⬜ | | |

**Legend:** ⬜ Not tested &nbsp; ✅ Pass &nbsp; ❌ Fail &nbsp; ⚠️ Partial

---

## Known Limitations (v1.0)

- **Cron jobs** run once daily on Vercel Hobby plan (not every 5–15 min). Broadcast sends, follow-ups, and drip sequences may appear delayed during UAT.
- **Security isolation tests** (6 items) are marked `it.todo()` — these require a live multi-tenant setup with two active tenant accounts to run properly.
- **Broadcasts/followups/drip crons** are removed from `vercel.json` for Hobby plan compatibility — manual triggers can be used for testing.
- **PDF processing** depends on the ingest cron being triggered; allow up to 24 hours on Hobby plan, or trigger manually via `/api/ingest/[botId]/process`.
- **WhatsApp/Telegram webhooks** require the bots to be publicly accessible and registered with Meta/Telegram respectively — end-to-end channel tests require live credentials.
