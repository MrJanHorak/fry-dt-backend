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

export function validateAssessment(req, res, next) {
  const {
    testType,
    words,
    responses,
    teacherNotes,
    assessmentData,
    score,
    duration
  } = req.body
  const errors = []

  // Required fields
  if (!testType || typeof testType !== 'string') {
    errors.push('Test type is required and must be a string')
  } else if (
    !['recognition', 'pronunciation', 'spelling', 'reading'].includes(testType)
  ) {
    errors.push(
      'Test type must be one of: recognition, pronunciation, spelling, reading'
    )
  }

  // Validate words array (required)
  if (!words || !Array.isArray(words) || words.length === 0) {
    errors.push('Words is required and must be a non-empty array')
  } else {
    words.forEach((word, index) => {
      if (!word || typeof word !== 'string' || !word.trim()) {
        errors.push(`Word at index ${index} must be a non-empty string`)
      }
    })
  }

  // Validate score (optional)
  if (
    score !== undefined &&
    (typeof score !== 'number' || score < 0 || score > 100)
  ) {
    errors.push('Score must be a number between 0 and 100')
  }

  // Validate duration (optional)
  if (duration !== undefined && (!Number.isInteger(duration) || duration < 0)) {
    errors.push('Duration must be a non-negative integer (milliseconds)')
  }

  // Validate responses array (optional)
  if (responses && !Array.isArray(responses)) {
    errors.push('Responses must be an array')
  } else if (responses) {
    responses.forEach((response, index) => {
      if (!response || typeof response !== 'object') {
        errors.push(`Response at index ${index} must be an object`)
        return
      }

      if (
        response.word &&
        (typeof response.word !== 'string' || !response.word.trim())
      ) {
        errors.push(
          `Response at index ${index}: word must be a non-empty string`
        )
      }

      if (
        response.correct !== undefined &&
        typeof response.correct !== 'boolean'
      ) {
        errors.push(`Response at index ${index}: correct must be a boolean`)
      }

      if (
        response.timeSpent !== undefined &&
        (!Number.isInteger(response.timeSpent) || response.timeSpent < 0)
      ) {
        errors.push(
          `Response at index ${index}: timeSpent must be a non-negative integer`
        )
      }

      if (
        response.attempts !== undefined &&
        (!Number.isInteger(response.attempts) || response.attempts < 1)
      ) {
        errors.push(
          `Response at index ${index}: attempts must be a positive integer`
        )
      }
    })
  }

  // Validate teacher notes
  if (teacherNotes && typeof teacherNotes !== 'string') {
    errors.push('Teacher notes must be a string')
  }

  // Validate assessment data
  if (assessmentData && typeof assessmentData !== 'object') {
    errors.push('Assessment data must be an object')
  }

  if (errors.length > 0) {
    return res.status(400).json({
      err: 'Assessment validation failed',
      details: errors
    })
  }

  next()
}

export function validateTestSession(req, res, next) {
  const { sessionType, wordsUsed, sessionSettings, results } = req.body
  const errors = []

  // Required fields
  if (!sessionType || typeof sessionType !== 'string') {
    errors.push('Session type is required and must be a string')
  } else if (
    !['individual', 'group', 'practice', 'assessment'].includes(sessionType)
  ) {
    errors.push(
      'Session type must be one of: individual, group, practice, assessment'
    )
  }

  // Validate words used array
  if (wordsUsed && !Array.isArray(wordsUsed)) {
    errors.push('Words used must be an array')
  } else if (wordsUsed) {
    wordsUsed.forEach((word, index) => {
      if (!word || typeof word !== 'string' || !word.trim()) {
        errors.push(`Word at index ${index} must be a non-empty string`)
      }
    })
  }

  // Validate session settings
  if (sessionSettings && typeof sessionSettings !== 'object') {
    errors.push('Session settings must be an object')
  } else if (sessionSettings) {
    if (
      sessionSettings.timeLimit !== undefined &&
      (!Number.isInteger(sessionSettings.timeLimit) ||
        sessionSettings.timeLimit <= 0)
    ) {
      errors.push('Time limit must be a positive integer')
    }

    if (
      sessionSettings.wordCount !== undefined &&
      (!Number.isInteger(sessionSettings.wordCount) ||
        sessionSettings.wordCount <= 0)
    ) {
      errors.push('Word count must be a positive integer')
    }

    if (
      sessionSettings.testTypes &&
      !Array.isArray(sessionSettings.testTypes)
    ) {
      errors.push('Test types must be an array')
    } else if (sessionSettings.testTypes) {
      const validTestTypes = [
        'recognition',
        'pronunciation',
        'spelling',
        'reading'
      ]
      sessionSettings.testTypes.forEach((type, index) => {
        if (!validTestTypes.includes(type)) {
          errors.push(
            `Test type at index ${index} must be one of: ${validTestTypes.join(
              ', '
            )}`
          )
        }
      })
    }
  }

  // Validate results
  if (results && typeof results !== 'object') {
    errors.push('Results must be an object')
  } else if (results) {
    if (
      results.totalWords !== undefined &&
      (!Number.isInteger(results.totalWords) || results.totalWords < 0)
    ) {
      errors.push('Total words must be a non-negative integer')
    }

    if (
      results.correctWords !== undefined &&
      (!Number.isInteger(results.correctWords) || results.correctWords < 0)
    ) {
      errors.push('Correct words must be a non-negative integer')
    }

    if (
      results.averageResponseTime !== undefined &&
      (typeof results.averageResponseTime !== 'number' ||
        results.averageResponseTime < 0)
    ) {
      errors.push('Average response time must be a non-negative number')
    }

    if (
      results.averageConfidence !== undefined &&
      (typeof results.averageConfidence !== 'number' ||
        results.averageConfidence < 0 ||
        results.averageConfidence > 1)
    ) {
      errors.push('Average confidence must be a number between 0 and 1')
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      err: 'Test session validation failed',
      details: errors
    })
  }

  next()
}
