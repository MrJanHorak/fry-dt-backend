#!/usr/bin/env node
/**
 * End-to-end smoke test against a RUNNING server and real database.
 *
 *   npm run smoke                                  # http://localhost:3001
 *   npm run smoke -- --api https://api.example.com
 *
 * Creates two teacher accounts and one student named "smoke-…" (with
 * emails ending in @example.invalid), then checks sign-up, adding a
 * student, QR card login, practice, progress, insights, CSV export,
 * assignments, access control and socket authentication. Prints ✓/✗ for
 * each step and exits with code 1 if anything failed.
 *
 * Add --cleanup (with MONGO_DB set) to delete the smoke-test accounts and
 * their data afterwards. Don't run against production without --force.
 */
import 'dotenv/config.js'
import crypto from 'crypto'
import { io } from 'socket.io-client'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const option = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}
const API = option('--api', process.env.SMOKE_API || 'http://localhost:3001').replace(/\/+$/, '')
const tag = crypto.randomBytes(3).toString('hex')
const results = []

async function call(path, { method = 'GET', token, body, raw = false } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let json = null
  if (!raw) {
    try {
      json = JSON.parse(text)
    } catch {
      /* not JSON */
    }
  }
  return { status: res.status, json, text, headers: res.headers }
}

async function step(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail })
    console.log(`  ✓ ${name}${detail ? ` (${detail})` : ''}`)
    return true
  } catch (err) {
    results.push({ name, ok: false, detail: err.message })
    console.log(`  ✗ ${name}: ${err.message}`)
    return false
  }
}

const expectStatus = (res, ...codes) => {
  if (!codes.includes(res.status)) {
    throw new Error(`HTTP ${res.status} ${res.json?.err || res.text.slice(0, 120)}`)
  }
}

function socketCheck(token) {
  return new Promise((resolve) => {
    const socket = io(API, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000
    })
    const done = (outcome) => {
      socket.close()
      resolve(outcome)
    }
    socket.on('connect', () => done('connected'))
    socket.on('connect_error', (e) => done(`rejected: ${e.message}`))
    setTimeout(() => done('timeout'), 6000)
  })
}

async function main() {
  if (/^https:\/\//.test(API) && !flag('--force') && !/localhost|127\.0\.0\.1/.test(API)) {
    console.log(`Running against ${API}. Add --force to confirm you want test accounts created there.`)
    process.exit(1)
  }
  console.log(`Smoke test against ${API} (tag ${tag})\n`)
  const ctx = {}
  const password = `pw-${crypto.randomBytes(6).toString('hex')}`

  await step('Server is up (/health)', async () => {
    const r = await call('/health')
    expectStatus(r, 200)
    return r.json?.environment
  })

  const signedUp = await step('Teacher can sign up', async () => {
    const r = await call('/api/auth/signup', {
      method: 'POST',
      body: { name: `smoke-teacher-${tag}`, email: `smoke-${tag}@example.invalid`, password, role: 'teacher' }
    })
    expectStatus(r, 201)
    ctx.teacherToken = r.json.token
    ctx.teacherProfile = JSON.parse(Buffer.from(r.json.token.split('.')[1], 'base64url')).user.profile
  })
  if (!signedUp) return finish()

  await step('Students cannot self-register', async () => {
    const r = await call('/api/auth/signup', {
      method: 'POST',
      body: { name: `smoke-kid-${tag}`, email: `smoke-kid-${tag}@example.invalid`, password, role: 'student' }
    })
    expectStatus(r, 400)
  })

  await step('Teacher can add a student', async () => {
    const r = await call('/api/auth/addStudent', {
      method: 'POST',
      token: ctx.teacherToken,
      body: { name: `smoke-student-${tag}`, grade: 1 }
    })
    expectStatus(r, 201)
    ctx.studentId = r.json.student._id
  })

  await step('Teacher can print a QR login card', async () => {
    const r = await call(`/api/auth/students/${ctx.studentId}/login-card`, { method: 'POST', token: ctx.teacherToken })
    expectStatus(r, 201)
    ctx.card = r.json
  })

  await step('Student can sign in with the QR card', async () => {
    const r = await call('/api/auth/qr-login', { method: 'POST', body: { name: ctx.card.name, code: ctx.card.code } })
    expectStatus(r, 200)
    ctx.studentToken = r.json.token
  })

  await step('A wrong QR code is refused', async () => {
    const r = await call('/api/auth/qr-login', { method: 'POST', body: { name: ctx.card.name, code: 'wrong' } })
    expectStatus(r, 401)
  })

  await step('Student gets a practice session', async () => {
    const r = await call(`/api/progress/${ctx.studentId}/practice`, { token: ctx.studentToken })
    expectStatus(r, 200)
    ctx.words = r.json.words.map((w) => w.word)
    if (!ctx.words.length) throw new Error('no words returned')
    return `${ctx.words.length} words`
  })

  await step('Student can save practice', async () => {
    const r = await call(`/api/progress/${ctx.studentId}/attempts`, {
      method: 'POST',
      token: ctx.studentToken,
      body: {
        attempts: ctx.words.slice(0, 3).map((word, i) => ({ word, correct: i !== 2, responseMs: 1500 + i * 500 }))
      }
    })
    expectStatus(r, 201)
    return `${r.json.saved} saved`
  })

  await step('Teacher can save a benchmark result', async () => {
    const r = await call(`/api/progress/${ctx.studentId}/attempts`, {
      method: 'POST',
      token: ctx.teacherToken,
      body: { attempts: [{ word: 'the', correct: true, responseMs: 900, context: 'benchmark' }] }
    })
    expectStatus(r, 201)
  })

  await step('Student summary shows the new data', async () => {
    const r = await call(`/api/progress/${ctx.studentId}/summary`, { token: ctx.teacherToken })
    expectStatus(r, 200)
    if (r.json.totals.attempts < 4) throw new Error(`expected 4 attempts, got ${r.json.totals.attempts}`)
    return `${r.json.totals.attempts} attempts`
  })

  await step('Class progress and insights include the student', async () => {
    const c = await call('/api/progress/class?list=1', { token: ctx.teacherToken })
    expectStatus(c, 200)
    const i = await call('/api/progress/insights?days=7', { token: ctx.teacherToken })
    expectStatus(i, 200)
    if (c.json.rows.length !== 1 || i.json.totals.activeStudents !== 1) {
      throw new Error('student missing from class views')
    }
  })

  await step('CSV export downloads', async () => {
    const r = await call('/api/progress/class/export.csv', { token: ctx.teacherToken, raw: true })
    expectStatus(r, 200)
    if (!/text\/csv/.test(r.headers.get('content-type'))) throw new Error('not CSV')
  })

  await step('Assignment reaches the student', async () => {
    const created = await call('/api/assignments', {
      method: 'POST',
      token: ctx.teacherToken,
      body: { title: `Smoke ${tag}`, students: [ctx.studentId], words: ['said', 'were'] }
    })
    expectStatus(created, 201)
    const mine = await call('/api/assignments', { token: ctx.studentToken })
    expectStatus(mine, 200)
    if (!mine.json.some((a) => a.title === `Smoke ${tag}`)) throw new Error('not visible to student')
  })

  await step("Another teacher cannot see this student", async () => {
    const other = await call('/api/auth/signup', {
      method: 'POST',
      body: { name: `smoke-teacher2-${tag}`, email: `smoke2-${tag}@example.invalid`, password, role: 'teacher' }
    })
    expectStatus(other, 201)
    const r = await call(`/api/profiles/${ctx.studentId}`, { token: other.json.token })
    expectStatus(r, 403)
  })

  await step('Students cannot see class data', async () => {
    const r = await call('/api/progress/insights', { token: ctx.studentToken })
    expectStatus(r, 403)
  })

  await step('Sockets without a login are rejected', async () => {
    const outcome = await socketCheck(null)
    if (!outcome.startsWith('rejected')) throw new Error(outcome)
  })

  await step('Sockets with a login connect', async () => {
    const outcome = await socketCheck(ctx.teacherToken)
    if (outcome !== 'connected') throw new Error(outcome)
  })

  await step('"Say it" speech pack (optional)', async () => {
    const r = await fetch(`${API}/models/vosk-model-small-en-us.tar.gz`, { method: 'HEAD' })
    return r.ok ? 'hosted' : 'not installed (run npm run fetch:vosk-model to enable on Chromebooks)'
  })

  return finish()
}

async function finish() {
  if (flag('--cleanup')) await cleanup()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)
  if (failed.length) process.exitCode = 1
}

async function cleanup() {
  if (!process.env.MONGO_DB) {
    console.log('  (skip cleanup: MONGO_DB is not set)')
    return
  }
  const mongoose = (await import('mongoose')).default
  const { User } = await import('../models/user.js')
  const { Profile } = await import('../models/profile.js')
  const { WordAttempt } = await import('../models/wordAttempt.js')
  const { Assignment } = await import('../models/assignment.js')
  await mongoose.connect(process.env.MONGO_DB)
  const emails = [`smoke-${tag}@example.invalid`, `smoke2-${tag}@example.invalid`]
  const ids = (await Profile.find({ email: { $in: emails } }).select('_id').lean()).map((p) => p._id)
  await WordAttempt.deleteMany({ student: { $in: ids } })
  await Assignment.deleteMany({ teacher: { $in: ids } })
  await User.deleteMany({ profile: { $in: ids } })
  await Profile.deleteMany({ _id: { $in: ids } })
  await mongoose.disconnect()
  console.log(`  Cleaned up ${ids.length} smoke-test profiles.`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
