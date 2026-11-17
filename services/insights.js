/**
 * Class insights for teachers: who is practising, who is progressing, and
 * who needs attention. Pure functions (no database) so they are testable.
 *
 * "Needs attention" flags are prompts for a teacher's judgement, never
 * labels for children, and are shown only to the student's own teachers.
 */
import { automaticityRate, dayKey, masteredAsOf } from './mastery.js'

const DAY_MS = 24 * 60 * 60 * 1000

export const FLAG_TEXT = {
  'no-practice': 'No practice in the last {days} days',
  'below-goal': '{gap} words below the goal line',
  stalled: 'Practising, but no new words mastered in 2 weeks',
  'low-accuracy': 'Getting fewer than 60% right lately. Practice may be too hard'
}

const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''))

/** Words a student should have mastered today if on track for their goal. */
export function expectedOnAimLine(goal, now) {
  if (!goal?.targetWords || !goal?.targetDate) return null
  const start = new Date(goal.baselineDate || now).getTime()
  const end = new Date(goal.targetDate).getTime()
  const base = goal.baselineWords || 0
  if (end <= start) return goal.targetWords
  const t = Math.min(1, Math.max(0, (new Date(now).getTime() - start) / (end - start)))
  return Math.round(base + (goal.targetWords - base) * t)
}

export function goalStatus(goal, mastered, now) {
  const expected = expectedOnAimLine(goal, now)
  if (expected === null) return { status: 'none', expected: null, gap: 0 }
  if (mastered >= goal.targetWords) return { status: 'met', expected, gap: 0 }
  const tolerance = Math.max(2, Math.round(expected * 0.1))
  const gap = expected - mastered
  return { status: gap > tolerance ? 'below' : 'on-track', expected, gap: Math.max(0, gap) }
}

/**
 * @param {object} student   Profile (name, accommodations, goal)
 * @param {object[]} attempts WordAttempt records for this student
 */
export function studentInsight(student, attempts = [], { now = new Date(), days = 7 } = {}) {
  const nowMs = new Date(now).getTime()
  const since = nowMs - days * DAY_MS
  const acc = student.accommodations || {}
  const sorted = [...attempts].sort((a, b) => new Date(a.date) - new Date(b.date))
  const recent = sorted.filter((a) => new Date(a.date).getTime() >= since)
  const last = sorted.at(-1)

  const masteredNow = masteredAsOf(sorted, now, acc)
  const masteredAtStart = masteredAsOf(sorted, new Date(since), acc)
  const masteredTwoWeeksAgo = masteredAsOf(sorted, new Date(nowMs - 14 * DAY_MS), acc)
  const practiceDays14 = new Set(
    sorted
      .filter((a) => new Date(a.date).getTime() >= nowMs - 14 * DAY_MS)
      .map((a) => dayKey(a.date))
  ).size

  const last20 = sorted.slice(-20)
  const accuracy = last20.length ? last20.filter((a) => a.correct).length / last20.length : null
  const goal = goalStatus(student.goal, masteredNow, now)

  const flags = []
  if (!last || new Date(last.date).getTime() < since) flags.push('no-practice')
  if (goal.status === 'below') flags.push('below-goal')
  if (practiceDays14 >= 3 && masteredNow - masteredTwoWeeksAgo <= 0 && masteredNow < 1000) {
    flags.push('stalled')
  }
  if (last20.length >= 10 && accuracy < 0.6) flags.push('low-accuracy')

  return {
    studentId: String(student._id),
    name: student.name,
    avatar: student.avatar,
    grade: student.grade,
    lastPracticed: last ? new Date(last.date).toISOString() : null,
    practiceDays: new Set(recent.map((a) => dayKey(a.date))).size,
    attempts: recent.length,
    mastered: masteredNow,
    masteredGained: Math.max(0, masteredNow - masteredAtStart),
    accuracy,
    automaticityRate: automaticityRate(sorted, 30, now),
    goal: { ...goal, targetWords: student.goal?.targetWords ?? null, targetDate: student.goal?.targetDate ?? null },
    flags: flags.map((code) => ({
      code,
      text: fill(FLAG_TEXT[code], { days, gap: goal.gap })
    }))
  }
}

export function classInsights(students, attemptsByStudent, { now = new Date(), days = 7 } = {}) {
  const nowMs = new Date(now).getTime()
  const rows = students.map((s) =>
    studentInsight(s, attemptsByStudent.get(String(s._id)) || [], { now, days })
  )

  // Practice per day for the last 14 days (for the activity chart)
  const daily = Array.from({ length: 14 }, (_, i) => {
    const date = dayKey(new Date(nowMs - (13 - i) * DAY_MS))
    return { date, attempts: 0, students: 0 }
  })
  const index = new Map(daily.map((d, i) => [d.date, i]))
  for (const s of students) {
    const daysSeen = new Set()
    for (const a of attemptsByStudent.get(String(s._id)) || []) {
      const i = index.get(dayKey(a.date))
      if (i === undefined) continue
      daily[i].attempts += 1
      daysSeen.add(i)
    }
    daysSeen.forEach((i) => (daily[i].students += 1))
  }

  const withRates = rows.filter((r) => r.automaticityRate !== null)
  return {
    period: {
      days,
      from: dayKey(new Date(nowMs - days * DAY_MS)),
      to: dayKey(now)
    },
    totals: {
      students: rows.length,
      activeStudents: rows.filter((r) => r.attempts > 0).length,
      attempts: rows.reduce((sum, r) => sum + r.attempts, 0),
      wordsMastered: rows.reduce((sum, r) => sum + r.masteredGained, 0),
      automaticityRate: withRates.length
        ? withRates.reduce((sum, r) => sum + r.automaticityRate, 0) / withRates.length
        : null,
      onTrack: rows.filter((r) => ['on-track', 'met'].includes(r.goal.status)).length,
      withGoals: rows.filter((r) => r.goal.status !== 'none').length
    },
    daily,
    students: rows.sort((a, b) => a.name.localeCompare(b.name)),
    attention: rows
      .filter((r) => r.flags.length)
      .sort((a, b) => b.flags.length - a.flags.length || a.name.localeCompare(b.name))
  }
}
