import crypto from 'crypto'
import mongoose from 'mongoose'
import { User, hashLoginCode } from '../models/user.js'
import { Profile } from '../models/profile.js'
import { createJWT } from '../middleware/auth.js'
import { loadRequester, isEducatorOf, pick } from '../middleware/authorize.js'

// Only these roles may self-register. Student accounts are created by a
// teacher or parent through /addStudent so every child has a responsible adult.
const SELF_SIGNUP_ROLES = ['teacher', 'parent']
const SIGNUP_FIELDS = ['name', 'email', 'password', 'avatar', 'grade', 'role']
const STUDENT_FIELDS = ['name', 'avatar', 'grade', 'password']

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const nameTaken = async (name) =>
  Boolean(
    await User.findOne({
      name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i')
    })
      .select('_id')
      .lean()
  )

async function signup(req, res) {
  const body = pick(req.body, SIGNUP_FIELDS)

  if (!body.email || !body.password || !body.name) {
    return res.status(400).json({ err: 'Missing required fields' })
  }

  body.role = body.role || 'teacher'
  if (!SELF_SIGNUP_ROLES.includes(body.role)) {
    return res.status(400).json({
      err: 'Student accounts are created by a teacher or parent'
    })
  }

  body.name = body.name.trim()
  body.grade = body.grade || 0
  body.avatar = body.avatar || '🙂'

  const existingProfile = await Profile.findOne({ email: body.email })
  if (existingProfile || (await nameTaken(body.name))) {
    return res.status(409).json({ err: 'Account already exists' })
  }

  const newProfile = await Profile.create({
    name: body.name,
    email: body.email,
    avatar: body.avatar,
    grade: body.grade,
    role: body.role
  })

  try {
    const user = await User.create({
      name: body.name,
      email: body.email,
      password: body.password,
      role: body.role,
      profile: newProfile._id
    })
    res.status(201).json({ token: createJWT(user) })
  } catch (userErr) {
    await Profile.findByIdAndDelete(newProfile._id)
    throw userErr
  }
}

/**
 * A teacher/parent adds a student to their own roster.
 * The student's login name must be unique. If no password is given, a random
 * one is set and the student signs in with their personal QR login card.
 */
async function addStudent(req, res) {
  const requester = await loadRequester(req)
  if (!requester || !['teacher', 'parent'].includes(requester.role)) {
    return res
      .status(403)
      .json({ err: 'Only teachers and parents can add students' })
  }

  const body = pick(req.body, STUDENT_FIELDS)
  if (!body.name || !body.name.trim()) {
    return res.status(400).json({ err: 'Missing required fields' })
  }
  body.name = body.name.trim()

  if (await nameTaken(body.name)) {
    return res.status(409).json({
      err: `The login name "${body.name}" is taken. Try adding an initial, e.g. "${body.name}-${requester.name?.[0] || 'A'}".`
    })
  }

  const teacherProfile = await Profile.findById(requester.profileId)
  const studentProfile = await Profile.create({
    name: body.name,
    email: teacherProfile.email,
    avatar: body.avatar || '😊',
    grade: Number(body.grade) || 1,
    role: 'student'
  })

  try {
    const studentUser = await User.create({
      name: body.name,
      email: teacherProfile.email,
      password: body.password || crypto.randomBytes(24).toString('base64url'),
      role: 'student',
      profile: studentProfile._id
    })

    teacherProfile.students.push(studentProfile._id)
    await teacherProfile.save()

    // Note: no token is returned. The adult stays signed in as themselves.
    res.status(201).json({
      student: {
        _id: studentProfile._id,
        name: studentProfile.name,
        avatar: studentProfile.avatar,
        grade: studentProfile.grade
      },
      userId: studentUser._id
    })
  } catch (userErr) {
    await Profile.findByIdAndDelete(studentProfile._id)
    throw userErr
  }
}

async function login(req, res) {
  const user = await User.findOne({ name: req.body.name })
  if (!user) {
    return res.status(401).json({ err: 'Invalid credentials' })
  }

  const isMatch = await new Promise((resolve, reject) => {
    user.comparePassword(req.body.pw, (err, match) => {
      if (err) reject(err)
      else resolve(match)
    })
  })

  if (!isMatch) {
    return res.status(401).json({ err: 'Invalid credentials' })
  }

  res.json({ token: createJWT(user) })
}

/** Teacher/parent sets a new password for one of their own students. */
async function changePassword(req, res) {
  if (!req.body.student || !req.body.newPw) {
    return res.status(400).json({ err: 'Missing required fields' })
  }
  if (!mongoose.isValidObjectId(req.body.student)) {
    return res.status(400).json({ err: 'Invalid student ID' })
  }
  if (String(req.body.newPw).length < 6) {
    return res
      .status(400)
      .json({ err: 'Password must be at least 6 characters long' })
  }

  const requester = await loadRequester(req)
  if (!isEducatorOf(requester, req.body.student)) {
    return res
      .status(403)
      .json({ err: 'You can only change passwords for your own students' })
  }

  const user = await User.findOne({ profile: req.body.student })
  if (!user) {
    return res.status(404).json({ err: 'User not found' })
  }

  user.password = req.body.newPw
  user.isPasswordUpdate = true
  await user.save()

  res.status(200).json({ msg: 'Password updated successfully' })
}

/**
 * Issues (or re-issues) a student's personal QR login card.
 * Re-issuing invalidates the previously printed card.
 */
async function issueLoginCard(req, res) {
  const user = await User.findOne({ profile: req.params.studentId }).select(
    '+loginCodeHash'
  )
  if (!user) {
    return res.status(404).json({ err: 'Student not found' })
  }

  const code = user.issueLoginCode()
  await user.save()

  res.status(201).json({
    name: user.name,
    profileId: String(user.profile),
    code,
    // What the QR encodes. The app recognises this prefix when scanning.
    qrValue: `frydt:${encodeURIComponent(user.name)}:${code}`,
    issuedAt: user.loginCodeIssuedAt
  })
}

/** Students sign in by scanning their QR card. */
async function qrLogin(req, res) {
  const { name, code } = req.body || {}
  if (typeof name !== 'string' || typeof code !== 'string' || !code) {
    return res.status(400).json({ err: 'Invalid login card' })
  }

  const user = await User.findOne({ name, role: 'student' }).select(
    '+loginCodeHash'
  )
  const expected = user?.loginCodeHash
  const actual = hashLoginCode(code)

  const ok =
    expected &&
    expected.length === actual.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual))

  if (!ok) {
    return res
      .status(401)
      .json({ err: 'This login card is not valid. Ask your teacher.' })
  }

  res.json({ token: createJWT(user) })
}

export {
  signup,
  login,
  changePassword,
  addStudent,
  issueLoginCard,
  qrLogin,
  createJWT
}
