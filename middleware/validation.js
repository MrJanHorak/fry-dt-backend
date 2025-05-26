/**
 * Input validation middleware using express-validator equivalent logic
 */

export function validateSignup(req, res, next) {
  const { email, password, name, role } = req.body
  const errors = []

  // Check required fields
  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required and must be a non-empty string')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email must be a valid email address')
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password is required and must be at least 6 characters long')
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Name is required and must be a non-empty string')
  }

  if (role && !['teacher', 'student'].includes(role)) {
    errors.push('Role must be either "teacher" or "student"')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      err: 'Validation failed',
      details: errors
    })
  }

  next()
}

export function validateLogin(req, res, next) {
  const { name, pw } = req.body
  const errors = []

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Username is required and must be a non-empty string')
  }

  if (!pw || typeof pw !== 'string') {
    errors.push('Password is required')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      err: 'Validation failed',
      details: errors
    })
  }

  next()
}

export function validateAddStudent(req, res, next) {
  const { name, email } = req.body
  const errors = []

  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Student name is required and must be a non-empty string')
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Parent email is required and must be a non-empty string')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Email must be a valid email address')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      err: 'Validation failed',
      details: errors
    })
  }

  next()
}

export function validateObjectId(paramName) {
  return (req, res, next) => {
    const id = req.params[paramName]
    const objectIdRegex = /^[0-9a-fA-F]{24}$/

    if (!id || !objectIdRegex.test(id)) {
      return res.status(400).json({
        err: `Invalid ${paramName}. Must be a valid MongoDB ObjectId`
      })
    }

    next()
  }
}

export function validatePracticedWord(req, res, next) {
  const { word, timesPracticed, timesCorrect, timesIncorrect } = req.body
  const errors = []

  if (!word || typeof word !== 'string' || !word.trim()) {
    errors.push('Word is required and must be a non-empty string')
  }

  if (
    timesPracticed !== undefined &&
    (!Number.isInteger(timesPracticed) || timesPracticed < 0)
  ) {
    errors.push('Times practiced must be a non-negative integer')
  }

  if (
    timesCorrect !== undefined &&
    (!Number.isInteger(timesCorrect) || timesCorrect < 0)
  ) {
    errors.push('Times correct must be a non-negative integer')
  }

  if (
    timesIncorrect !== undefined &&
    (!Number.isInteger(timesIncorrect) || timesIncorrect < 0)
  ) {
    errors.push('Times incorrect must be a non-negative integer')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      err: 'Validation failed',
      details: errors
    })
  }

  next()
}
