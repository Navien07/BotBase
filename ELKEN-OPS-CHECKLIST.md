# Elken Deployment Ops Checklist

## After Code Deploy (git push → Vercel auto-deploy)

### Step 1 — Apply 3 DB migrations in Supabase SQL Editor
Project: kyywrzctcoocbozbnsqc

Run in this order:
- [ ] 00027_elken_booking_rpc.sql
- [ ] 00028_elken_pic_contacts.sql
- [ ] 00029_elken_brochure_url.sql

Verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'bots' AND column_name = 'pic_contacts';
-- → 1 row

SELECT column_name FROM information_schema.columns
WHERE table_name = 'documents' AND column_name = 'brochure_url';
-- → 1 row
```

### Step 2 — n8n Setup for Admin Notification Dispatch Only

n8n is **only needed for admin PIC notifications** (`dispatchAdminNotification`).
All customer-facing notifications (reminders, surveys, brochures) are sent
natively by BotBase's channel dispatcher — no n8n required.

For the n8n outbound workflow, only one branch is needed:

**Trigger:** Webhook (receives POST from BotBase)
**Switch on** `type` field:
  `admin_notification` → WhatsApp TEXT to `{{ $json.targetNumber }}`

The following branches are **NO LONGER NEEDED** in n8n:
- ~~confirmation/reminder/survey~~ → handled natively by BotBase
- ~~brochure~~ → handled natively by BotBase

Set n8n webhook URL for admin notifications only:
```sql
UPDATE bots
SET n8n_outbound_webhook = 'YOUR_N8N_WEBHOOK_URL'
WHERE id = '21794953-b13f-4e5f-984a-1536c453461d';
```

- [ ] n8n webhook workflow created (admin_notification branch only)
- [ ] `n8n_outbound_webhook` URL set in DB (SQL above)

> **Note:** If n8n is not yet configured, PIC notifications will silently
> fail (`dispatchAdminNotification` returns false) but all customer
> notifications (reminders, surveys, brochures) will still work natively.

### Step 3 — Re-run seed
```bash
NEXT_PUBLIC_SUPABASE_URL=https://kyywrzctcoocbozbnsqc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<your_key> \
node lib/tenants/elken/seed/seed-elken.mjs
```
- [ ] Seed exits 0
- [ ] Verify 3 new payment FAQ rows in `faqs` table

### Step 4 — Configure n8n outbound (3 webhook branches)
- [ ] `confirmation`/`reminder`/`survey` → WhatsApp TEXT to `{{ $json.userId }}`
- [ ] `admin_notification` → WhatsApp TEXT to `{{ $json.targetNumber }}`
- [ ] `brochure` → WhatsApp DOCUMENT to `{{ $json.userId }}` with `{{ $json.brochureUrl }}`

### Step 5 — Set n8n webhook URL in DB
```sql
UPDATE bots
SET n8n_outbound_webhook = 'YOUR_N8N_WEBHOOK_URL'
WHERE id = '21794953-b13f-4e5f-984a-1536c453461d';
```
- [ ] n8n webhook URL set

### Step 6 — Set PIC numbers in dashboard
- [ ] Dashboard → Ask Ethan Digital → Booking → Settings → PIC Notifications
- [ ] GenQi OKR: `+60122208396`
- [ ] GenQi Subang: `+60122206215`
- [ ] Click Save — verify GET `/api/config/<botId>/pic-contacts` returns both numbers

### Step 7 — Upload KB files
Facility info (upload immediately via Dashboard → Knowledge Base):
- [ ] `01_genqi_old_klang_road.txt`
- [ ] `02_genqi_subang.txt`
- [ ] `03_genqi_booking_rules_and_policies.txt`
- [ ] `04_elken_bes_device.txt`
- [ ] `05_elken_company_and_membership.txt`
- [ ] `06_payment_visitor_guidelines_faq.txt`
- [ ] `09_health_concern_product_guide_UPDATED.txt` (with real product names: Xeniji, Ormega, Calmag, etc.)

Product PDFs (rename using convention `{category}_{product-line}_{language}.pdf` before uploading):
- [ ] All `beauty_` files → Beauty folder
- [ ] All `fmcg_` files → FMCG folder
- [ ] All `health_` files → Healthfood folder
- [ ] All `genqi_` files → GenQi Products folder
- [ ] All `appliances_` files → Home Appliances folder
- [ ] Wait for all document statuses → "ready"
- [ ] Verify `brochure_url` is populated: `SELECT title, brochure_url FROM documents WHERE bot_id = '21794953-b13f-4e5f-984a-1536c453461d' AND brochure_url IS NOT NULL;`

### Step 8 — Verify Supabase SMTP
- [ ] Dashboard → Auth → Settings → SMTP → ON
- [ ] Host: `smtp.resend.com` | Port: `465` | User: `resend`
- [ ] From: `noreply@icebergaisolutions.com`

### Step 9 — Run automated Telegram test
```bash
TELEGRAM_BOT_TOKEN=xxx TELEGRAM_TEST_CHAT_ID=yyy \
node scripts/test-elken-telegram.mjs
```
- [ ] All 9 scenarios PASS

### Step 10 — Manual WhatsApp verification
- [ ] Send "Hi" → 2-item greeting in correct language
- [ ] Book Female Bed OKR as member → full flow → confirmation received
- [ ] Book as non-member → trial type prompt → specialist message
- [ ] Ask "I have joint pain" → Ormega/C-Joie card + PDF brochure received
- [ ] PIC WhatsApp receives notification for each booking
- [ ] Check Vercel logs → no errors

## Quick verification commands
```bash
# Migrations numbered correctly (27, 28, 29)
ls botbase/supabase/migrations/ | grep elken

# tsc clean
cd botbase && npx tsc --noEmit; echo "Exit: $?"

# dispatch route exists
ls botbase/app/api/notifications/dispatch/route.ts && echo "PASS: dispatch route exists"

# Grep key wiring points
grep -r "dispatchAdminNotification" botbase/app/api/bookings/
grep -r "dispatchBrochure" botbase/app/api/chat/
grep -r "parseElkenFilename" botbase/app/api/ingest/
grep "PIC Notifications" botbase/app/dashboard/bots/\[botId\]/booking/page.tsx
```
