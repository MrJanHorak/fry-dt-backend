import mongoose from 'mongoose'
import { Profile } from '../models/profile.js'
import { WordAttempt } from '../models/wordAttempt.js'
import { Assignment } from '../models/assignment.js'
import { loadRequester, isEducatorOf } from '../middleware/authorize.js'
import { getFryList, canonicalWord } from '../data/fryWords.js'
import {
  summarizeStudent,
  listBreakdown,
  workingList,
  weeklyTrend,
  automaticityRate,
  buildPracticeQueue,
  classMatrix,
  wordKey,
  MASTERY_DAYS
} from '../services/mastery.js'

const WORD_PATTERN = /^[A-Za-z][A-Za-z' -]{0,39}$/
const MAX_ATTEMPTS_PER_REQUEST = 100
const DEFAULT_ACCOMMODATIONS = {
  automaticitySeconds: 3,
  untimed: false,
  wordsPerSession: 10,
  newWordsPerSession: 3,
  choiceCount: 3,
  receptiveCountsForMastery: false,
  autoReadWords: false,
  breakReminderMinutes: 10,
  responseModes: ['self-check', 'choice', 'build']
}

const accommodationsOf = (profile) => ({
  ...DEFAULT_ACCOMMODATIONS,
  ...(profile?.accommodations || {})
})

const loadAttempts = (studentId) =>
  WordAttempt.find({ student: studentId }).sort({ date: 1 }).lean()

const activeAssignmentsFor = (studentId) =>
  Assignment.find({ students: studentId, status: 'active' })
    .select('title note words activities targetDays dueDate teacher createdAt')
    .lean()

/**
 * POST /api/progress/:studentId/attempts
 * Body: { attempts: [{ word, correct, responseMs, skill, context, scoredBy,
 *                     errorResponse, helpUsed, assignmentId, sessionId }] }
 *
 * Automaticity is calculated here from the student's accommodations,
 * never trusted from the client.
 */
export async function recordAttempts(req, res) {
  const { studentId } = req.params
  const incoming = Array.isArray(req.body?.attempts) ? req.body.attempts : []

  if (!incoming.length || incoming.length > MAX_ATTEMPTS_PER_REQUEST) {
    return res.status(400).json({
      err: `Send between 1 and ${MAX_ATTEMPTS_PER_REQUEST} attempts`
    })
  }

  const requester = await loadRequester(req)
  const isAdult = isEducatorOf(requester, studentId)
  const student = await Profile.findById(studentId)
    .select('accommodations role')
    .lean()
  if (!student) return res.status(404).json({ err: 'Student not found' })

  const acc = accommodationsOf(student)
  const thresholdMs = acc.automaticitySeconds * 1000
  const errors = []

  const docs = incoming.map((a, i) => {
    const word = typeof a.word === 'string' ? a.word.trim() : ''
    if (!WORD_PATTERN.test(word)) errors.push(`Attempt ${i + 1}: invalid word`)
    if (typeof a.correct !== 'boolean') {
      errors.push(`Attempt ${i + 1}: "correct" must be true or false`)
    }

    const responseMs =
      typeof a.responseMs === 'number' && a.responseMs >= 0 && a.responseMs < 600000
        ? Math.round(a.responseMs)
        : undefined
    const timed = !acc.untimed && responseMs !== undefined
    const skill = a.skill === 'receptive' ? 'receptive' : 'expressive'

    // Students practising alone can only log practice they judged themselves
    let context = ['benchmark', 'practice', 'live'].includes(a.context)
      ? a.context
      : 'practice'
    let scoredBy = ['teacher', 'self', 'speech', 'choice'].includes(a.scoredBy)
      ? a.scoredBy
      : isAdult
        ? 'teacher'
        : 'self'
    if (!isAdult) {
      context = 'practice'
      if (scoredBy === 'teacher') scoredBy = 'self'
    }

    return {
      student: studentId,
      recordedBy: requester.profileId,
      word: canonicalWord(word) || word,
      wordKey: wordKey(word),
      fryList: getFryList(word) || undefined,
      correct: Boolean(a.correct),
      responseMs,
      timed,
      automatic: Boolean(a.correct) && timed && responseMs <= thresholdMs,
      skill,
      context,
      scoredBy,
      errorResponse:
        typeof a.errorResponse === 'string'
          ? a.errorResponse.slice(0, 60)
          : undefined,
      helpUsed: Boolean(a.helpUsed),
      assignment: mongoose.isValidObjectId(a.assignmentId)
        ? a.assignmentId
        : undefined,
      sessionId:
        typeof a.sessionId === 'string' ? a.sessionId.slice(0, 64) : undefined,
      date: new Date()
    }
  })

  if (errors.length) {
    return res.status(400).json({ err: 'Validation failed', details: errors })
  }

  await WordAttempt.insertMany(docs)
  res.status(201).json({
    saved: docs.length,
    results: docs.map(({ word, correct, automatic, timed }) => ({
      word,
      correct,
      automatic,
      timed
    }))
  })
}

/** GET /api/progress/:studentId/summary */
export async function getSummary(req, res) {
  const { studentId } = req.params
  const [student, attempts, assignments] = await Promise.all([
    Profile.findById(studentId)
      .select('name avatar grade role currentLevel accommodations accessibility goal')
      .lean(),
    loadAttempts(studentId),
    activeAssignmentsFor(studentId)
  ])
  if (!student) return res.status(404).json({ err: 'Student not found' })

  const acc = accommodationsOf(student)
  const summaries = summarizeStudent(attempts, acc)
  const lists = listBreakdown(summaries)
  const masteredTotal = lists.reduce((s, l) => s + l.mastered + l.review, 0)
  const trend = weeklyTrend(attempts, acc, 12)

  const requester = await loadRequester(req)
  const canSeeAccommodations = isEducatorOf(requester, studentId)

  res.json({
    student: {
      _id: student._id,
      name: student.name,
      avatar: student.avatar,
      grade: student.grade,
      currentLevel: student.currentLevel || 1,
      accessibility: student.accessibility || {},
      ...(canSeeAccommodations ? { accommodations: acc } : {})
    },
    criteria: {
      masteryDays: MASTERY_DAYS,
      automaticitySeconds: acc.untimed ? null : acc.automaticitySeconds,
      untimed: acc.untimed
    },
    totals: {
      mastered: masteredTotal,
      attemptedWords: summaries.size,
      attempts: attempts.length,
      automaticityRate: automaticityRate(attempts)
    },
    workingList: workingList(lists),
    lists,
    trend,
    goal: student.goal || null,
    words: [...summaries.values()].sort(
      (a, b) => (a.fryList || 99) - (b.fryList || 99) || a.word.localeCompare(b.word)
    ),
    assignments: assignments.map((asg) => ({
      ...asg,
      progress: asg.words.map((w) => ({
        word: w,
        status: summaries.get(wordKey(w))?.status || 'not-yet',
        masteryDays: summaries.get(wordKey(w))?.masteryDays || 0
      }))
    }))
  })
}

/** GET /api/progress/:studentId/practice – the next practice session */
export async function getPracticeSession(req, res) {
  const { studentId } = req.params
  const [student, attempts, assignments] = await Promise.all([
    Profile.findById(studentId)
      .select('name currentLevel accommodations accessibility pitch rate voice')
      .lean(),
    loadAttempts(studentId),
    activeAssignmentsFor(studentId)
  ])
  if (!student) return res.status(404).json({ err: 'Student not found' })

  const acc = accommodationsOf(student)
  const summaries = summarizeStudent(attempts, acc)
  const lists = listBreakdown(summaries)

  // Optionally practise one assignment only
  const onlyAssignment = req.query.assignment
    ? assignments.find((a) => String(a._id) === String(req.query.assignment))
    : null
  const assignedWords = onlyAssignment
    ? onlyAssignment.words
    : assignments.flatMap((a) => a.words)

  const words = onlyAssignment
    ? buildPracticeQueue(summaries, {
        assignedWords,
        workingList: workingList(lists),
        accommodations: {
          ...acc,
          // Assignment practice may include all of its words
          newWordsPerSession: Math.max(acc.newWordsPerSession, assignedWords.length)
        }
      }).filter((w) => assignedWords.map(wordKey).includes(wordKey(w)))
    : buildPracticeQueue(summaries, {
        assignedWords,
        workingList: Math.min(student.currentLevel || 10, workingList(lists)),
        accommodations: acc
      })

  res.json({
    words: words.map((w) => ({
      word: w,
      status: summaries.get(wordKey(w))?.status || 'not-yet',
      fryList: getFryList(w)
    })),
    assignment: onlyAssignment
      ? { _id: onlyAssignment._id, title: onlyAssignment.title, note: onlyAssignment.note, activities: onlyAssignment.activities }
      : null,
    assignments: assignments.map((a) => ({
      _id: a._id,
      title: a.title,
      note: a.note,
      dueDate: a.dueDate,
      activities: a.activities,
      wordCount: a.words.length,
      masteredCount: a.words.filter((w) =>
        ['mastered'].includes(summaries.get(wordKey(w))?.status)
      ).length
    })),
    accommodations: {
      untimed: acc.untimed,
      choiceCount: acc.choiceCount,
      autoReadWords: acc.autoReadWords,
      breakReminderMinutes: acc.breakReminderMinutes,
      responseModes: acc.responseModes
    },
    voice: { pitch: student.pitch, rate: student.rate, voice: student.voice },
    workingList: workingList(lists)
  })
}

/** GET /api/progress/class?list=N – teacher's whole roster on one list */
export async function getClassProgress(req, res) {
  const requester = await loadRequester(req)
  const list = Math.min(10, Math.max(1, Number(req.query.list) || 1))
  const studentIds = [...requester.studentIds]

  const [students, attempts] = await Promise.all([
    Profile.find({ _id: { $in: studentIds } })
      .select('name avatar grade accommodations currentLevel')
      .sort({ name: 1 })
      .lean(),
    WordAttempt.find({ student: { $in: studentIds } })
      .select('student word wordKey correct automatic timed skill helpUsed date')
      .lean()
  ])

  const byStudent = new Map()
  for (const a of attempts) {
    const key = String(a.student)
    if (!byStudent.has(key)) byStudent.set(key, [])
    byStudent.get(key).push(a)
  }

  res.json(classMatrix(students, byStudent, list))
}
