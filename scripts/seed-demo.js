#!/usr/bin/env node
/**
 * Creates a fictional demo class so every screen has realistic data:
 * one teacher, six students (steady, strong, struggling, absent, untimed,
 * non-speaking), ~8 weeks of practice + benchmark history, goals and
 * assignments.
 *
 *   npm run seed:demo             # create the demo class
 *   npm run seed:demo -- --reset  # delete the demo class (and recreate it)
 *   npm run seed:demo -- --remove # delete the demo class only
 *
 * Sign in as "Demo Teacher" (or any Demo-… student) with the password it
 * prints, or set DEMO_PASSWORD. Refuses to run when NODE_ENV=production
 * unless you add --force. Only touches records belonging to the demo
 * teacher (email demo-teacher@example.invalid).
 */
import 'dotenv/config.js'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { User } from '../models/user.js'
import { Profile } from '../models/profile.js'
import { WordAttempt } from '../models/wordAttempt.js'
import { Assignment } from '../models/assignment.js'
import { generateDemo, DEMO_EMAIL, DEMO_TEACHER_NAME, DEMO_STUDENTS } from '../services/demoData.js'

const args = new Set(process.argv.slice(2))
const AVATARS = ['🦊', '🐢', '🦉', '🐬', '🦋', '🐼']

async function removeDemo() {
  const profiles = await Profile.find({ email: DEMO_EMAIL }).select('_id').lean()
  const ids = profiles.map((p) => p._id)
  if (!ids.length) return 0
  await Promise.all([
    WordAttempt.deleteMany({ student: { $in: ids } }),
    Assignment.deleteMany({ teacher: { $in: ids } }),
    User.deleteMany({ $or: [{ profile: { $in: ids } }, { email: DEMO_EMAIL }] })
  ])
  await Profile.deleteMany({ _id: { $in: ids } })
  return ids.length
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !args.has('--force')) {
    console.error('Refusing to add demo data with NODE_ENV=production (add --force if you really mean it).')
    process.exit(1)
  }
  if (!process.env.MONGO_DB) {
    console.error('Set MONGO_DB (see .env.example) first.')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGO_DB)

  if (args.has('--reset') || args.has('--remove')) {
    const removed = await removeDemo()
    console.log(`Removed ${removed} demo profiles and their data.`)
    if (args.has('--remove')) return
  } else if (await Profile.exists({ email: DEMO_EMAIL })) {
    console.log('The demo class already exists. Use --reset to recreate it or --remove to delete it.')
    return
  }

  const names = [DEMO_TEACHER_NAME, ...DEMO_STUDENTS.map((s) => s.name)]
  const clash = await User.findOne({ name: { $in: names } }).select('name').lean()
  if (clash) {
    console.error(`A real account is already called "${clash.name}". Nothing was changed.`)
    process.exit(1)
  }

  const password = process.env.DEMO_PASSWORD || crypto.randomBytes(6).toString('base64url')
  const demo = generateDemo()

  const teacherProfile = await Profile.create({
    name: DEMO_TEACHER_NAME,
    email: DEMO_EMAIL,
    avatar: '🍎',
    grade: 2,
    role: 'teacher'
  })
  await User.create({
    name: DEMO_TEACHER_NAME,
    email: DEMO_EMAIL,
    password,
    role: 'teacher',
    profile: teacherProfile._id
  })

  const idByName = new Map()
  let totalAttempts = 0
  for (const [i, s] of demo.students.entries()) {
    const profile = await Profile.create({
      name: s.name,
      email: DEMO_EMAIL,
      avatar: AVATARS[i % AVATARS.length],
      grade: s.grade,
      role: 'student',
      currentLevel: 1,
      accommodations: s.accommodations,
      goal: { ...s.goal, setBy: teacherProfile._id }
    })
    await User.create({ name: s.name, email: DEMO_EMAIL, password, role: 'student', profile: profile._id })
    idByName.set(s.name, profile._id)

    const docs = s.attempts.map((a) => ({
      ...a,
      student: profile._id,
      recordedBy: a.context === 'benchmark' ? teacherProfile._id : profile._id
    }))
    for (let k = 0; k < docs.length; k += 1000) {
      await WordAttempt.insertMany(docs.slice(k, k + 1000), { ordered: false })
    }
    totalAttempts += docs.length
  }

  teacherProfile.students = [...idByName.values()]
  await teacherProfile.save()

  for (const a of demo.assignments) {
    await Assignment.create({
      teacher: teacherProfile._id,
      students: a.studentNames.map((n) => idByName.get(n)),
      title: a.title,
      note: a.note,
      words: a.words,
      status: 'active'
    })
  }

  console.log(`
Demo class created: 1 teacher, ${idByName.size} students, ${totalAttempts} word reads, ${demo.assignments.length} assignments.

  Teacher login:  ${DEMO_TEACHER_NAME}
  Student logins: ${[...idByName.keys()].join(', ')}
  Password (all): ${password}

Remove it any time with: npm run seed:demo -- --remove`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
