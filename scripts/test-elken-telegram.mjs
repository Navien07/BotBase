#!/usr/bin/env node
// scripts/test-elken-telegram.mjs
// Automated Telegram test for the Elken "Ask Ethan Digital" bot.
//
// Usage:
//   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_TEST_CHAT_ID=yyy node scripts/test-elken-telegram.mjs
//
// Prerequisites:
//   - Bot must be deployed and Telegram webhook registered
//   - The chat_id must have sent at least one message to the bot before

const TOKEN   = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_TEST_CHAT_ID

if (!TOKEN || !CHAT_ID) {
  console.error('❌  Missing TELEGRAM_BOT_TOKEN or TELEGRAM_TEST_CHAT_ID')
  process.exit(1)
}

const API = `https://api.telegram.org/bot${TOKEN}`

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function send(text) {
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  })
  if (!res.ok) throw new Error(`sendMessage failed: ${res.status}`)
}

async function getLatestBotReply(afterUpdateId) {
  const res = await fetch(`${API}/getUpdates?limit=20&allowed_updates=["message"]`)
  const data = await res.json()
  if (!data.ok) throw new Error('getUpdates failed')

  const replies = (data.result ?? [])
    .filter(u =>
      u.update_id > afterUpdateId &&
      u.message?.from?.is_bot === true &&
      String(u.message?.chat?.id) === String(CHAT_ID)
    )
  return replies[replies.length - 1]?.message?.text ?? null
}

async function getLastUpdateId() {
  const res = await fetch(`${API}/getUpdates?limit=1`)
  const data = await res.json()
  const updates = data.result ?? []
  return updates.length > 0 ? updates[updates.length - 1].update_id : 0
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function sendAndWait(text, waitMs = 4000) {
  const updateId = await getLastUpdateId()
  await send(text)
  await sleep(waitMs)
  return getLatestBotReply(updateId)
}

function assert(label, reply, ...expectedSubstrings) {
  if (!reply) {
    console.log(`  ❌  FAIL [${label}]: No reply received`)
    return false
  }
  const lower = reply.toLowerCase()
  for (const expected of expectedSubstrings) {
    if (!lower.includes(expected.toLowerCase())) {
      console.log(`  ❌  FAIL [${label}]: Expected "${expected}" in reply`)
      console.log(`       Got: ${reply.slice(0, 200)}`)
      return false
    }
  }
  console.log(`  ✅  PASS [${label}]`)
  return true
}

// ─── Test scenarios ───────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n🤖  Elken Telegram Bot — Automated Test Suite')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  let passed = 0
  let failed = 0

  function record(ok) { ok ? passed++ : failed++ }

  // ── Scenario 1: Greeting ──────────────────────────────────────────────────
  console.log('Scenario 1: Initial greeting')
  let reply = await sendAndWait('Hi')
  record(assert('Greeting contains Ethan + menu', reply, 'ethan', '1.', '2.'))

  // ── Scenario 2: Select booking ────────────────────────────────────────────
  console.log('\nScenario 2: Select booking option')
  reply = await sendAndWait('2')
  record(assert('Location prompt', reply, 'which centre', 'old klang road', 'subang'))

  // ── Scenario 3: Select OKR location ──────────────────────────────────────
  console.log('\nScenario 3: Select GenQi Old Klang Road')
  reply = await sendAndWait('1')
  record(assert('OKR facility list', reply, 'female bed', 'male bed', 'meeting'))

  // ── Scenario 4: Select female bed ────────────────────────────────────────
  console.log('\nScenario 4: Select Female bed')
  reply = await sendAndWait('Female bed')
  record(assert('Bed details prompt', reply, 'preferred date', 'member of elken'))

  // ── Scenario 5: Member booking details ───────────────────────────────────
  console.log('\nScenario 5: Member booking — provide details')
  reply = await sendAndWait('15 May 2026 2pm, Sarah, 0123456789, yes member', 5000)
  record(assert('BES device prompt', reply, 'bes', 'bring'))

  // ── Scenario 6: BES answer → confirmation ────────────────────────────────
  console.log('\nScenario 6: No BES → member confirmation')
  reply = await sendAndWait('no BES')
  record(assert('Member booking confirmed', reply, 'all set sarah', 'confirmed'))

  // ── Scenario 7: Non-member flow start ────────────────────────────────────
  console.log('\nScenario 7: Non-member flow — restart booking')
  await sendAndWait('Hi')
  await sendAndWait('2')
  await sendAndWait('1')    // OKR
  reply = await sendAndWait('Male bed')
  record(assert('Male bed details prompt', reply, 'preferred date', 'member of elken'))

  console.log('\nScenario 7 (cont): Non-member details')
  reply = await sendAndWait('20 May 2026 3pm, Tom, 0198765432, not a member', 5000)
  record(assert('Trial type prompt', reply, 'free 20 mins', 'back', 'foot'))

  // ── Scenario 8: Trial type → specialist message ───────────────────────────
  console.log('\nScenario 8: Select trial type "back"')
  reply = await sendAndWait('back')
  record(assert('Specialist follow-up message', reply, 'specialist', 'contact you'))

  // ── Scenario 9: Health concern → product recommendation ───────────────────
  console.log('\nScenario 9: Health concern query')
  reply = await sendAndWait('tell me about joint pain', 5000)
  record(assert('Joint pain → Ormega or C-Joie', reply, 'ormega', 'c-joie'))

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Results: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log('❌  Some tests failed — check bot logs on Vercel')
    process.exit(1)
  } else {
    console.log('✅  All tests passed!')
  }
}

runTests().catch(err => {
  console.error('❌  Test runner error:', err)
  process.exit(1)
})
