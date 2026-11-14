import mongoose from 'mongoose'
import { Assignment } from '../models/assignment.js'
import { WordAttempt } from '../models/wordAttempt.js'
import { Profile } from '../models/profile.js'
import { loadRequester, pick } from '../middleware/authorize.js'
import { canonicalWord } from '../data/fryWords.js'
import { summarizeStudent, wordKey } from '../services/mastery.js'

const WORD_PATTERN = /^[A-Za-z][A-Za-z' -]{0,39}$/
const EDITABLE = ['title', 'note', 'words', 'students', 'activities', 'targetDays', 'dueDate', 'status']

function cleanWords(words) {
  if (!Array.isArray(words)) return { error: 'words must be a list' }
  const seen = new Set()
  const out = []
  for (const raw of words) {
    const word = typeof raw === 'string' ? raw.trim() : ''
    if (!WORD_PATTERN.test(word)) return { error: `"${raw}" is not a valid word` }
    const key = wordKey(word)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(canonicalWord(word) || word)
  }
  if (!out.length || out.length > 50) {
    return { error: 'An assignment needs between 1 and 50 words' }
  }
  return { words: out }
}

function checkStudents(requester, students) {
  if (!Array.isArray(students) || !students.length) {
    return 'Choose at least one student'
  }
  const invalid = students.filter(
    (id) =>
      !mongoose.isValidObjectId(id) ||
      (!requester.isAdmin && !requester.studentIds.has(String(id)))
  )
  return invalid.length ? 'You can only assign words to your own students' : null
}

async function progressFor(assignment) {
  const studentIds = assignment.students.map(String)
  const [profiles, attempts] = await Promise.all([
    Profile.find({ _id: { $in: studentIds } })
      .select('name avatar accommodations')
      .lean(),
    WordAttempt.find({
      student: { $in: studentIds },
      wordKey: { $in: assignment.words.map(wordKey) }
    }).lean()
  ])

  return profiles.map((p) => {
    const mine = attempts.filter((a) => String(a.student) === String(p._id))
    const summaries = summarizeStudent(mine, p.accommodations || {})
    const words = assignment.words.map((w) => {
      const s = summaries.get(wordKey(w))
      return {
        word: w,
        status: s?.status || 'not-yet',
        masteryDays: s?.masteryDays || 0,
        done: (s?.masteryDays || 0) >= assignment.targetDays && s?.status !== 'review'
      }
    })
    return {
      studentId: p._id,
      name: p.name,
      avatar: p.avatar,
      doneCount: words.filter((w) => w.done).length,
      practiced: mine.length > 0,
      words
    }
  })
}

/** GET /api/assignments – teachers see theirs, students see their active ones */
export async function index(req, res) {
  const requester = await loadRequester(req)

  if (requester.role === 'student') {
    const assignments = await Assignment.find({
      students: requester.profileId,
      status: 'active'
    })
      .select('title note words activities targetDays dueDate createdAt')
      .sort({ createdAt: -1 })
      .lean()
    return res.json(assignments)
  }

  const filter = { teacher: requester.profileId }
  if (req.query.status) filter.status = req.query.status
  const assignments = await Assignment.find(filter)
    .sort({ createdAt: -1 })
    .populate({ path: 'students', select: 'name avatar' })
    .lean()
  res.json(assignments)
}

/** POST /api/assignments */
export async function create(req, res) {
  const requester = await loadRequester(req)
  const body = pick(req.body, EDITABLE)

  const studentError = checkStudents(requester, body.students)
  if (studentError) return res.status(400).json({ err: studentError })

  const { words, error } = cleanWords(body.words)
  if (error) return res.status(400).json({ err: error })

  if (!body.title || !String(body.title).trim()) {
    return res.status(400).json({ err: 'Give the assignment a title' })
  }

  const assignment = await Assignment.create({
    ...body,
    words,
    status: 'active',
    teacher: requester.profileId
  })
  res.status(201).json(assignment)
}

async function loadOwned(req, res) {
  const requester = await loadRequester(req)
  const assignment = await Assignment.findById(req.params.id)
  if (!assignment) {
    res.status(404).json({ err: 'Assignment not found' })
    return null
  }
  if (!requester.isAdmin && String(assignment.teacher) !== requester.profileId) {
    res.status(403).json({ err: 'This is not your assignment' })
    return null
  }
  return { assignment, requester }
}

/** PUT /api/assignments/:id */
export async function update(req, res) {
  const owned = await loadOwned(req, res)
  if (!owned) return
  const { assignment, requester } = owned
  const body = pick(req.body, EDITABLE)

  if (body.students) {
    const studentError = checkStudents(requester, body.students)
    if (studentError) return res.status(400).json({ err: studentError })
  }
  if (body.words) {
    const { words, error } = cleanWords(body.words)
    if (error) return res.status(400).json({ err: error })
    body.words = words
  }

  assignment.set(body)
  await assignment.save()
  res.json(assignment)
}

/** DELETE /api/assignments/:id – archives (keeps history) */
export async function archive(req, res) {
  const owned = await loadOwned(req, res)
  if (!owned) return
  owned.assignment.status = 'archived'
  await owned.assignment.save()
  res.json({ msg: 'Assignment archived' })
}

/** GET /api/assignments/:id/progress */
export async function progress(req, res) {
  const owned = await loadOwned(req, res)
  if (!owned) return
  res.json({
    assignment: owned.assignment,
    students: await progressFor(owned.assignment)
  })
}
