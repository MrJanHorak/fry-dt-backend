/**
 * Mastery, spaced-repetition and progress calculations.
 *
 * Pure functions (no database access) so they are easy to test and reason
 * about. Definitions follow common practice in sight-word intervention and
 * curriculum-based measurement:
 *
 *  - AUTOMATIC: read correctly within the student's automaticity threshold
 *    (default 3 seconds; adjustable per student as an accommodation).
 *  - MASTERED: read correctly and automatically on MASTERY_DAYS separate days.
 *    Requiring separate days checks retention, not just short-term memory.
 *  - REVIEW: was mastered, but the most recent attempt was missed.
 *  - LEARNING: read correctly at least once but not yet mastered.
 *  - NOT KNOWN: attempted, never read correctly.
 *  - NOT YET: never tried.
 *
 * Practice uses a Leitner-style spaced-repetition schedule, and sessions keep
 * most words familiar with only a few unknown words mixed in (in the spirit
 * of incremental rehearsal), so children succeed most of the time.
 */

import { getFryList, getListWords, canonicalWord } from '../data/fryWords.js'

export const MASTERY_DAYS = 3
// Days to wait before reviewing again, indexed by Leitner box
export const REVIEW_INTERVAL_DAYS = [0, 1, 2, 4, 7, 14, 30]
export const STATUSES = ['mastered', 'review', 'learning', 'not-known', 'not-yet']

const DAY_MS = 24 * 60 * 60 * 1000

export const dayKey = (date) => new Date(date).toISOString().slice(0, 10)
export const wordKey = (word) => String(word || '').trim().toLowerCase()

/** Does this attempt count toward mastery for this student? */
export function isQualifying(attempt, { receptiveCountsForMastery = false } = {}) {
  if (!attempt.correct) return false
  if (attempt.skill === 'receptive' && !receptiveCountsForMastery) return false
  if (attempt.helpUsed) return false
  // Untimed attempts (accommodation) count on accuracy alone
  return attempt.timed === false || Boolean(attempt.automatic)
}

/** Should an attempt be considered at all for this student's mastery? */
const isRelevant = (attempt, accommodations) =>
  attempt.skill !== 'receptive' ||
  Boolean(accommodations?.receptiveCountsForMastery)

/**
 * Summarize one word from that word's attempts (any order).
 */
export function summarizeWord(word, attempts = [], accommodations = {}, now = new Date()) {
  const relevant = attempts
    .filter((a) => isRelevant(a, accommodations))
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const base = {
    word: canonicalWord(word) || word,
    fryList: getFryList(word),
    attempts: relevant.length,
    correct: relevant.filter((a) => a.correct).length,
    receptiveCorrect: attempts.filter((a) => a.skill === 'receptive' && a.correct).length,
    lastSeen: relevant[0]?.date || null,
    masteryDays: 0,
    box: 0,
    due: true,
    status: 'not-yet',
    avgResponseMs: null
  }

  if (!relevant.length) return base

  const qualifyingDays = new Set(
    relevant.filter((a) => isQualifying(a, accommodations)).map((a) => dayKey(a.date))
  )
  base.masteryDays = qualifyingDays.size

  const times = relevant
    .filter((a) => a.correct && typeof a.responseMs === 'number' && a.timed !== false)
    .map((a) => a.responseMs)
  base.avgResponseMs = times.length
    ? Math.round(times.reduce((s, t) => s + t, 0) / times.length)
    : null

  const latestCorrect = relevant[0].correct
  if (base.masteryDays >= MASTERY_DAYS) {
    base.status = latestCorrect ? 'mastered' : 'review'
  } else if (base.correct > 0) {
    base.status = 'learning'
  } else {
    base.status = 'not-known'
  }

  // Leitner box = consecutive days (newest first) with a qualifying read and
  // no miss on that day. A miss sends the word back to box 0.
  const byDay = new Map()
  for (const a of relevant) {
    const key = dayKey(a.date)
    const entry = byDay.get(key) || { miss: false, hit: false }
    if (!a.correct) entry.miss = true
    else if (isQualifying(a, accommodations)) entry.hit = true
    byDay.set(key, entry)
  }
  let box = 0
  for (const key of [...byDay.keys()].sort().reverse()) {
    const { miss, hit } = byDay.get(key)
    if (miss) break
    if (hit) box += 1
  }
  base.box = Math.min(box, REVIEW_INTERVAL_DAYS.length - 1)

  const nextDue =
    new Date(base.lastSeen).getTime() + REVIEW_INTERVAL_DAYS[base.box] * DAY_MS
  base.due = nextDue <= new Date(now).getTime()

  return base
}

/** Group attempts by word key. */
export function groupByWord(attempts = []) {
  const map = new Map()
  for (const a of attempts) {
    const key = a.wordKey || wordKey(a.word)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  return map
}

/** Summaries for every word a student has attempted (Map wordKey → summary). */
export function summarizeStudent(attempts = [], accommodations = {}, now = new Date()) {
  const result = new Map()
  for (const [key, list] of groupByWord(attempts)) {
    result.set(key, summarizeWord(list[0].word, list, accommodations, now))
  }
  return result
}

/** Per-list counts of each status for Fry lists 1–10. */
export function listBreakdown(summaries) {
  return Array.from({ length: 10 }, (_, i) => {
    const list = i + 1
    const counts = { list, mastered: 0, review: 0, learning: 0, 'not-known': 0, 'not-yet': 0 }
    for (const word of getListWords(list)) {
      const s = summaries.get(wordKey(word))
      counts[s ? s.status : 'not-yet'] += 1
    }
    return counts
  })
}

/**
 * The list a student should be working in: the first list where fewer than
 * 90% of words are mastered (90% is a common "independent level" cut-off).
 */
export function workingList(breakdown) {
  const found = breakdown.find((l) => l.mastered + l.review < 90)
  return found ? found.list : 10
}

/** Count of mastered words as of a given date (for trend lines). */
export function masteredAsOf(attempts, date, accommodations = {}) {
  const cutoff = new Date(date).getTime()
  const upTo = attempts.filter((a) => new Date(a.date).getTime() <= cutoff)
  let count = 0
  for (const s of summarizeStudent(upTo, accommodations, date).values()) {
    if (s.status === 'mastered' || s.status === 'review') count += 1
  }
  return count
}

/** Weekly progress-monitoring points for the last `weeks` weeks. */
export function weeklyTrend(attempts, accommodations = {}, weeks = 12, now = new Date()) {
  const end = new Date(now)
  return Array.from({ length: weeks }, (_, i) => {
    const date = new Date(end.getTime() - (weeks - 1 - i) * 7 * DAY_MS)
    return { weekEnding: dayKey(date), mastered: masteredAsOf(attempts, date, accommodations) }
  })
}

/** Share of timed, correct, expressive reads in the window that were automatic. */
export function automaticityRate(attempts, days = 30, now = new Date()) {
  const since = new Date(now).getTime() - days * DAY_MS
  const timedCorrect = attempts.filter(
    (a) =>
      a.correct &&
      a.timed !== false &&
      a.skill !== 'receptive' &&
      new Date(a.date).getTime() >= since
  )
  if (!timedCorrect.length) return null
  return timedCorrect.filter((a) => a.automatic).length / timedCorrect.length
}

const interleave = (familiar, unknown) => {
  // Spread unknown words evenly among familiar ones
  if (!unknown.length) return familiar
  const out = []
  const gap = Math.max(1, Math.floor(familiar.length / (unknown.length + 1)))
  let f = 0
  for (const word of unknown) {
    out.push(...familiar.slice(f, f + gap))
    f += gap
    out.push(word)
  }
  out.push(...familiar.slice(f))
  return out
}

/**
 * Builds a practice session.
 *
 * @param {Map} summaries         wordKey → summary (from summarizeStudent)
 * @param {object} options
 *   assignedWords   words from the student's active assignments
 *   workingList     Fry list to draw new words from
 *   accommodations  wordsPerSession / newWordsPerSession
 */
export function buildPracticeQueue(summaries, options = {}) {
  const {
    assignedWords = [],
    workingList: list = 1,
    accommodations = {}
  } = options
  const size = accommodations.wordsPerSession || 10
  const newMax = Math.min(accommodations.newWordsPerSession || 3, size)

  const statusOf = (word) => summaries.get(wordKey(word))?.status || 'not-yet'
  const summaryOf = (word) => summaries.get(wordKey(word))
  const used = new Set()
  const take = (word) => {
    const key = wordKey(word)
    if (used.has(key)) return false
    used.add(key)
    return true
  }

  const unknown = []
  const familiar = []
  const isUnknown = (s) => ['not-known', 'not-yet'].includes(s)

  // 1. Assigned words come first
  for (const word of assignedWords) {
    const status = statusOf(word)
    if (status === 'mastered' && !summaryOf(word)?.due) continue
    if (isUnknown(status)) {
      if (unknown.length < newMax && take(word)) unknown.push(word)
    } else if (take(word)) familiar.push(word)
  }

  const all = [...summaries.values()]
  const byOldest = (a, b) => new Date(a.lastSeen || 0) - new Date(b.lastSeen || 0)

  // 2. Words needing review, then learning words that are due
  for (const s of all.filter((x) => x.status === 'review').sort(byOldest)) {
    if (familiar.length + unknown.length >= size) break
    if (take(s.word)) familiar.push(s.word)
  }
  for (const s of all.filter((x) => x.status === 'learning' && x.due).sort(byOldest)) {
    if (familiar.length + unknown.length >= size) break
    if (take(s.word)) familiar.push(s.word)
  }

  // 3. A few unknown words: missed ones first, then new ones from the list
  for (const s of all.filter((x) => x.status === 'not-known').sort(byOldest)) {
    if (unknown.length >= newMax) break
    if (take(s.word)) unknown.push(s.word)
  }
  for (const word of getListWords(list)) {
    if (unknown.length >= newMax) break
    if (statusOf(word) === 'not-yet' && take(word)) unknown.push(word)
  }

  // 4. Fill with mastered words that are due (keeps success rate high)
  for (const s of all.filter((x) => x.status === 'mastered' && x.due).sort(byOldest)) {
    if (familiar.length + unknown.length >= size) break
    if (take(s.word)) familiar.push(s.word)
  }
  // ...then any other learning/mastered words
  for (const s of all
    .filter((x) => ['learning', 'mastered'].includes(x.status))
    .sort(byOldest)) {
    if (familiar.length + unknown.length >= size) break
    if (take(s.word)) familiar.push(s.word)
  }

  return interleave(familiar, unknown).slice(0, size)
}

/**
 * Class view: status of every student on every word in a list, plus the
 * words most often not known and suggested small groups.
 */
export function classMatrix(students, attemptsByStudent, list) {
  const words = getListWords(list)
  const rows = students.map((student) => {
    const id = String(student._id)
    const summaries = summarizeStudent(
      attemptsByStudent.get(id) || [],
      student.accommodations || {}
    )
    const statuses = {}
    for (const word of words) {
      statuses[word] = summaries.get(wordKey(word))?.status || 'not-yet'
    }
    const breakdown = listBreakdown(summaries)
    return {
      studentId: id,
      name: student.name,
      avatar: student.avatar,
      statuses,
      masteredInList: words.filter((w) => ['mastered', 'review'].includes(statuses[w])).length,
      totalMastered: breakdown.reduce((s, l) => s + l.mastered + l.review, 0),
      workingList: workingList(breakdown)
    }
  })

  const needs = (status) => ['not-known', 'learning', 'review'].includes(status)

  const wordStats = words.map((word) => {
    const strugglers = rows.filter((r) => needs(r.statuses[word]))
    const assessed = rows.filter((r) => r.statuses[word] !== 'not-yet').length
    return {
      word,
      needCount: strugglers.length,
      assessed,
      students: strugglers.map((r) => ({ studentId: r.studentId, name: r.name }))
    }
  })

  const mostMissed = wordStats
    .filter((w) => w.needCount > 0)
    .sort((a, b) => b.needCount - a.needCount)
    .slice(0, 15)

  // Small-group suggestion: students sharing the same not-yet-mastered words
  const groupsByWords = new Map()
  for (const row of rows) {
    const gaps = words.filter((w) => needs(row.statuses[w])).slice(0, 5)
    if (!gaps.length) continue
    const key = gaps.join('|')
    if (!groupsByWords.has(key)) groupsByWords.set(key, { words: gaps, students: [] })
    groupsByWords.get(key).students.push({ studentId: row.studentId, name: row.name })
  }
  // Also group by working list (instructional level)
  const byLevel = new Map()
  for (const row of rows) {
    if (!byLevel.has(row.workingList)) byLevel.set(row.workingList, [])
    byLevel.get(row.workingList).push({ studentId: row.studentId, name: row.name })
  }

  return {
    list,
    words,
    rows,
    mostMissed,
    suggestedGroups: [...groupsByWords.values()]
      .filter((g) => g.students.length > 1)
      .sort((a, b) => b.students.length - a.students.length)
      .slice(0, 6),
    levelGroups: [...byLevel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([level, members]) => ({ workingList: level, students: members }))
  }
}
