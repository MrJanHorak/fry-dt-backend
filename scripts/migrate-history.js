#!/usr/bin/env node
/**
 * Copies old assessment history (stored inside each student's Profile) into
 * the WordAttempt collection used by the new progress reports.
 *
 *   node scripts/migrate-history.js            # dry run: report only
 *   node scripts/migrate-history.js --apply    # write the records
 *
 * Safe to run more than once: records that already exist are skipped.
 * The original Profile data is never changed or deleted.
 */
import 'dotenv/config.js'
import mongoose from 'mongoose'
import { Profile } from '../models/profile.js'
import { WordAttempt } from '../models/wordAttempt.js'
import { attemptsFromProfile, dedupeKey } from '../services/migration.js'

const apply = process.argv.includes('--apply')

async function main() {
  if (!process.env.MONGO_DB) {
    console.error('Set MONGO_DB (see .env.example) before running this script.')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGO_DB)
  console.log(apply ? 'APPLYING migration' : 'DRY RUN (add --apply to write)')

  const cursor = Profile.find({ role: 'student', 'assessments.0': { $exists: true } })
    .select('_id name assessments accommodations')
    .lean()
    .cursor()

  let students = 0
  let found = 0
  let created = 0

  for await (const profile of cursor) {
    students += 1
    const attempts = attemptsFromProfile(profile)
    found += attempts.length
    if (!attempts.length) continue

    const existing = await WordAttempt.find({
      student: profile._id,
      sessionId: { $in: [...new Set(attempts.map((a) => a.sessionId))] }
    })
      .select('wordKey sessionId context')
      .lean()
    const seen = new Set(existing.map(dedupeKey))
    const fresh = attempts.filter((a) => !seen.has(dedupeKey(a)))

    console.log(`${profile.name}: ${attempts.length} old responses, ${fresh.length} new`)
    if (apply && fresh.length) {
      await WordAttempt.insertMany(fresh, { ordered: false })
      created += fresh.length
    } else {
      created += fresh.length
    }
  }

  console.log(
    `\n${students} students, ${found} old responses, ${created} ${apply ? 'created' : 'would be created'}.`
  )
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
