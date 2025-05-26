import { Profile } from '../models/profile.js'

async function index(req, res) {
  try {
    const profiles = await Profile.find({})
      .populate({
        path: 'students',
        model: 'Profile',
        select: ['name', 'avatar']
      })
      .lean() // Use lean for better performance when we don't need mongoose documents

    res.json(profiles)
  } catch (err) {
    console.error('Index profiles error:', err)
    res.status(500).json({ err: 'Error fetching profiles' })
  }
}

async function show(req, res) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ err: 'Profile ID is required' })
    }

    const profile = await Profile.findById(req.params.id).populate({
      path: 'students',
      select: ['name', 'avatar', 'practicedWords', 'fryGradelevel', 'tested']
    })

    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    res.status(200).json(profile)
  } catch (err) {
    console.error('Show profile error:', err)
    res.status(500).json({ err: 'Error fetching profile' })
  }
}

async function update(req, res) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ err: 'Profile ID is required' })
    }

    const profile = await Profile.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })

    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    res.status(200).json(profile)
  } catch (err) {
    console.error('Update profile error:', err)
    res.status(500).json({ err: 'Error updating profile' })
  }
}

async function addPracticedWord(req, res) {
  try {
    if (!req.params.id || !req.body) {
      return res
        .status(400)
        .json({ err: 'Profile ID and word data are required' })
    }

    const profile = await Profile.findById(req.params.id)
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    profile.practicedWords.push(req.body)
    await profile.save()

    res.status(200).json(profile.practicedWords)
  } catch (err) {
    console.error('Add practiced word error:', err)
    res.status(500).json({ err: 'Error adding practiced word' })
  }
}

async function updatePracticedWord(req, res) {
  try {
    if (!req.params.id || !req.params.practicedWordId || !req.body) {
      return res
        .status(400)
        .json({ err: 'Profile ID, word ID, and update data are required' })
    }

    const profile = await Profile.findById(req.params.id)
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    const wordIndex = profile.practicedWords.findIndex((word) =>
      word._id.equals(req.params.practicedWordId)
    )

    if (wordIndex === -1) {
      return res.status(404).json({ err: 'Practiced word not found' })
    }

    profile.practicedWords[wordIndex] = req.body
    await profile.save()

    res.status(200).json(profile.practicedWords[wordIndex])
  } catch (err) {
    console.error('Update practiced word error:', err)
    res.status(500).json({ err: 'Error updating practiced word' })
  }
}

async function removeStudentFromProfile(req, res) {
  try {
    if (!req.params.id || !req.params.studentId) {
      return res
        .status(400)
        .json({ err: 'Profile ID and student ID are required' })
    }

    const profile = await Profile.findById(req.params.id).populate('students')
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    const initialLength = profile.students.length
    profile.students = profile.students.filter(
      (student) => student.id !== req.params.studentId
    )

    if (profile.students.length === initialLength) {
      return res.status(404).json({ err: 'Student not found in profile' })
    }

    await profile.save()
    res.status(200).json(profile.students)
  } catch (err) {
    console.error('Remove student error:', err)
    res.status(500).json({ err: 'Error removing student from profile' })
  }
}

// Assessment-related functions
async function addAssessment(req, res) {
  try {
    if (!req.params.id || !req.body) {
      return res
        .status(400)
        .json({ err: 'Profile ID and assessment data are required' })
    }

    const profile = await Profile.findById(req.params.id)
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    // Add assessment with current timestamp
    const assessment = {
      ...req.body,
      date: new Date()
    }

    profile.assessments.push(assessment)
    await profile.save()

    res.status(201).json(assessment)
  } catch (err) {
    console.error('Add assessment error:', err)
    res.status(500).json({ err: 'Error adding assessment' })
  }
}

async function updateAssessment(req, res) {
  try {
    if (!req.params.id || !req.params.assessmentId || !req.body) {
      return res.status(400).json({
        err: 'Profile ID, assessment ID, and update data are required'
      })
    }

    const profile = await Profile.findById(req.params.id)
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    const assessmentIndex = profile.assessments.findIndex((assessment) =>
      assessment._id.equals(req.params.assessmentId)
    )

    if (assessmentIndex === -1) {
      return res.status(404).json({ err: 'Assessment not found' })
    }

    // Update assessment with new data
    profile.assessments[assessmentIndex] = {
      ...profile.assessments[assessmentIndex].toObject(),
      ...req.body,
      updatedAt: new Date()
    }

    await profile.save()
    res.status(200).json(profile.assessments[assessmentIndex])
  } catch (err) {
    console.error('Update assessment error:', err)
    res.status(500).json({ err: 'Error updating assessment' })
  }
}

async function getAssessments(req, res) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ err: 'Profile ID is required' })
    }

    const profile = await Profile.findById(req.params.id).select('assessments')
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    // Optional filtering by query parameters
    let assessments = profile.assessments

    if (req.query.word) {
      assessments = assessments.filter(
        (a) =>
          a.words &&
          a.words.some((word) =>
            word.toLowerCase().includes(req.query.word.toLowerCase())
          )
      )
    }

    if (req.query.testType) {
      assessments = assessments.filter((a) => a.testType === req.query.testType)
    }

    if (req.query.sessionId) {
      assessments = assessments.filter(
        (a) => a.sessionId === req.query.sessionId
      )
    }

    // Sort by date (most recent first)
    assessments.sort((a, b) => new Date(b.date) - new Date(a.date))

    res.status(200).json(assessments)
  } catch (err) {
    console.error('Get assessments error:', err)
    res.status(500).json({ err: 'Error fetching assessments' })
  }
}

// Test session-related functions
async function addTestSession(req, res) {
  try {
    if (!req.params.id || !req.body) {
      return res
        .status(400)
        .json({ err: 'Profile ID and test session data are required' })
    }

    const profile = await Profile.findById(req.params.id)
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    // Add test session with current timestamp
    const testSession = {
      ...req.body,
      startTime: new Date(),
      status: 'active'
    }

    profile.testSessions.push(testSession)
    await profile.save()

    res.status(201).json(testSession)
  } catch (err) {
    console.error('Add test session error:', err)
    res.status(500).json({ err: 'Error adding test session' })
  }
}

async function updateTestSession(req, res) {
  try {
    if (!req.params.id || !req.params.sessionId || !req.body) {
      return res
        .status(400)
        .json({ err: 'Profile ID, session ID, and update data are required' })
    }

    const profile = await Profile.findById(req.params.id)
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    const sessionIndex = profile.testSessions.findIndex(
      (session) => session.sessionId === req.params.sessionId
    )

    if (sessionIndex === -1) {
      return res.status(404).json({ err: 'Test session not found' })
    }

    // Update session with new data
    profile.testSessions[sessionIndex] = {
      ...profile.testSessions[sessionIndex].toObject(),
      ...req.body,
      updatedAt: new Date()
    }

    await profile.save()
    res.status(200).json(profile.testSessions[sessionIndex])
  } catch (err) {
    console.error('Update test session error:', err)
    res.status(500).json({ err: 'Error updating test session' })
  }
}

async function getTestSessions(req, res) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ err: 'Profile ID is required' })
    }

    const profile = await Profile.findById(req.params.id).select('testSessions')
    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    // Optional filtering by query parameters
    let testSessions = profile.testSessions

    if (req.query.teacherId) {
      testSessions = testSessions.filter(
        (s) => s.teacherId === req.query.teacherId
      )
    }

    if (req.query.testType) {
      testSessions = testSessions.filter(
        (s) => s.testType === req.query.testType
      )
    }

    if (req.query.status) {
      testSessions = testSessions.filter((s) => s.status === req.query.status)
    }

    // Sort by start time (most recent first)
    testSessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))

    res.status(200).json(testSessions)
  } catch (err) {
    console.error('Get test sessions error:', err)
    res.status(500).json({ err: 'Error fetching test sessions' })
  }
}

// Student progress analysis
async function getStudentProgress(req, res) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ err: 'Profile ID is required' })
    }

    const profile = await Profile.findById(req.params.id).select(
      'assessments testSessions practicedWords currentLevel fryGradelevel name'
    )

    if (!profile) {
      return res.status(404).json({ err: 'Profile not found' })
    }

    // Calculate progress statistics
    const assessments = profile.assessments || []
    const testSessions = profile.testSessions || []
    const practicedWords = profile.practicedWords || []

    // Flatten responses from all assessments for analysis
    const allResponses = []
    assessments.forEach((assessment) => {
      if (assessment.responses && Array.isArray(assessment.responses)) {
        assessment.responses.forEach((response) => {
          allResponses.push({
            ...response,
            testType: assessment.testType,
            date: assessment.date,
            assessmentId: assessment._id
          })
        })
      }
    })

    const progressData = {
      student: {
        name: profile.name,
        currentLevel: profile.currentLevel || 1,
        fryGradeLevel: profile.fryGradelevel || 1
      },
      totals: {
        assessments: assessments.length,
        testSessions: testSessions.length,
        practicedWords: practicedWords.length,
        totalWordsTested: 0,
        recognizedWords: 0
      },
      byTestType: {},
      recentProgress: [],
      wordMastery: {},
      sessionHistory: testSessions.slice(0, 10) // Last 10 sessions
    }

    // Calculate totals directly from assessments to avoid flattening issues
    let totalResponses = 0
    let correctResponses = 0

    assessments.forEach((assessment) => {
      if (assessment.responses && Array.isArray(assessment.responses)) {
        assessment.responses.forEach((response) => {
          totalResponses++
          if (response.correct) {
            correctResponses++
          }
        })
      }
    })

    progressData.totals.totalWordsTested = totalResponses
    progressData.totals.recognizedWords = correctResponses

    // Group by test type using direct assessment processing
    const testTypes = ['recognition', 'pronunciation', 'spelling', 'reading']
    testTypes.forEach((type) => {
      let typeTotal = 0
      let typeRecognized = 0
      let typeTimeTotal = 0
      let typeTimeCount = 0

      assessments.forEach((assessment) => {
        if (
          assessment.testType === type &&
          assessment.responses &&
          Array.isArray(assessment.responses)
        ) {
          assessment.responses.forEach((response) => {
            typeTotal++
            if (response.correct) {
              typeRecognized++
            }
            if (response.timeSpent) {
              typeTimeTotal += response.timeSpent
              typeTimeCount++
            }
          })
        }
      })

      progressData.byTestType[type] = {
        total: typeTotal,
        recognized: typeRecognized,
        averageResponseTime:
          typeTimeCount > 0 ? typeTimeTotal / typeTimeCount : 0
      }
    })

    // Word mastery analysis
    const wordStats = {}

    // Use the same approach as recentProgress to avoid flattening issues
    assessments.forEach((assessment) => {
      if (assessment.responses && Array.isArray(assessment.responses)) {
        assessment.responses.forEach((response) => {
          const word = response.word
          if (!wordStats[word]) {
            wordStats[word] = {
              attempts: 0,
              successes: 0,
              lastTested: null,
              totalAttempts: 0
            }
          }
          wordStats[word].attempts++
          wordStats[word].totalAttempts += response.attempts || 1
          if (response.correct) {
            wordStats[word].successes++
          }
          if (
            !wordStats[word].lastTested ||
            new Date(assessment.date) > new Date(wordStats[word].lastTested)
          ) {
            wordStats[word].lastTested = assessment.date
          }
        })
      }
    })

    progressData.wordMastery = Object.entries(wordStats)
      .map(([word, stats]) => ({
        word,
        masteryRate: stats.successes / stats.attempts,
        attempts: stats.attempts,
        successes: stats.successes,
        totalAttempts: stats.totalAttempts,
        lastTested: stats.lastTested
      }))
      .sort((a, b) => b.attempts - a.attempts)

    // Recent progress (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    progressData.recentProgress = assessments
      .filter((a) => new Date(a.date) >= thirtyDaysAgo)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20)

    res.status(200).json(progressData)
  } catch (err) {
    console.error('Get student progress error:', err)
    res.status(500).json({ err: 'Error fetching student progress' })
  }
}

// Get active speech recognition sessions for teacher monitoring
async function getActiveSpeechSessions(req, res) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ err: 'Profile ID is required' })
    }

    const teacherProfile = await Profile.findById(req.params.id).populate({
      path: 'students',
      select: ['name', 'avatar', 'practicedWords', 'testSessions'],
      match: { role: 'student' }
    })

    if (!teacherProfile) {
      return res.status(404).json({ err: 'Teacher profile not found' })
    }

    // Get active speech recognition sessions from students
    const activeSessions = []
    const currentTime = new Date()
    const sessionTimeoutMs = 5 * 60 * 1000 // 5 minutes timeout

    if (teacherProfile.students && teacherProfile.students.length > 0) {
      teacherProfile.students.forEach((student) => {
        // Check for recent pronunciation practice activity
        const recentPracticedWords = student.practicedWords
          ?.filter((word) => {
            const lastPracticed = new Date(word.lastPracticed)
            return currentTime - lastPracticed < sessionTimeoutMs
          })
          ?.sort(
            (a, b) => new Date(b.lastPracticed) - new Date(a.lastPracticed)
          )

        // Check for active test sessions
        const activeTestSessions = student.testSessions?.filter((session) => {
          if (session.status !== 'active') return false
          const startTime = new Date(session.startTime)
          return currentTime - startTime < sessionTimeoutMs
        })

        if (
          (recentPracticedWords && recentPracticedWords.length > 0) ||
          (activeTestSessions && activeTestSessions.length > 0)
        ) {
          const currentWord = recentPracticedWords?.[0]?.word || 'N/A'
          const confidence =
            recentPracticedWords?.[0]?.speechRecognitionScore || 0
          const responseTime = recentPracticedWords?.[0]?.responseTime || 0
          const wordsCompleted = recentPracticedWords?.length || 0
          const startTime =
            recentPracticedWords?.[0]?.lastPracticed ||
            activeTestSessions?.[0]?.startTime ||
            new Date()

          // Calculate struggling indicators
          const strugglingWords =
            recentPracticedWords
              ?.filter(
                (word) =>
                  word.speechRecognitionScore < 60 ||
                  word.timesIncorrect > word.timesCorrect
              )
              ?.map((word) => word.word)
              ?.slice(0, 3) || []

          const recentAttempts =
            recentPracticedWords?.slice(0, 5)?.map((word) => ({
              word: word.word,
              success: word.speechRecognitionScore >= 70,
              confidence: word.speechRecognitionScore,
              responseTime: word.responseTime
            })) || []

          const errors =
            recentPracticedWords
              ?.filter(
                (word) => word.recordOfWrongs && word.recordOfWrongs.length > 0
              )
              ?.flatMap((word) => word.recordOfWrongs)
              ?.slice(-2) || []

          activeSessions.push({
            studentId: student._id,
            studentName: student.name,
            avatar: student.avatar,
            currentWord,
            confidence,
            responseTime,
            wordsCompleted,
            startTime,
            strugglingWords,
            recentAttempts,
            errors,
            needsHelp:
              confidence < 60 ||
              responseTime > 10000 ||
              strugglingWords.length > 1
          })
        }
      })
    }

    res.status(200).json({
      sessions: activeSessions,
      totalSessions: activeSessions.length,
      timestamp: currentTime
    })
  } catch (err) {
    console.error('Get active speech sessions error:', err)
    res.status(500).json({ err: 'Error fetching active speech sessions' })
  }
}

export {
  index,
  show,
  update,
  addPracticedWord,
  updatePracticedWord,
  removeStudentFromProfile,
  addAssessment,
  updateAssessment,
  getAssessments,
  addTestSession,
  updateTestSession,
  getTestSessions,
  getStudentProgress,
  getActiveSpeechSessions
}
