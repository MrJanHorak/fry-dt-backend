/**
 * Testing socket handlers
 * Handles all real-time testing-related socket events for teacher-student testing
 */

import { Profile } from '../models/profile.js'

const activeTestSessions = new Map()

const getProfileId = (userLike) => {
  if (!userLike) return null

  if (typeof userLike === 'string') {
    return userLike
  }

  return userLike.profile || userLike._id || null
}

const createParticipantState = () => ({
  responsesByWord: new Map()
})

const getOrCreateParticipantState = (session, studentProfileId) => {
  if (!session.participants.has(studentProfileId)) {
    session.participants.set(studentProfileId, createParticipantState())
  }

  return session.participants.get(studentProfileId)
}

const normalizeScore = (score, recognized) => {
  if (typeof score === 'number') {
    if (score >= 0 && score <= 1) {
      return Math.round(score * 100)
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  return recognized ? 100 : 0
}

const buildSessionRecord = ({
  sessionId,
  sessionType,
  testType,
  wordsToTest,
  teacherProfileId,
  studentProfileId,
  startTime,
  fryLevel,
  status = 'active',
  endTime,
  results
}) => ({
  sessionId,
  sessionType,
  testType,
  wordsUsed: [...wordsToTest],
  sessionSettings: {
    wordCount: wordsToTest.length,
    testTypes: [testType]
  },
  results:
    results || {
      totalWords: wordsToTest.length,
      correctWords: 0,
      averageResponseTime: 0,
      averageConfidence: 0
    },
  teacherId: teacherProfileId,
  studentId: studentProfileId,
  startTime,
  endTime,
  status,
  teacherNotes: 'Teacher-led live session',
  fryLevel
})

const createActiveStudentSessionRecord = async (session, studentProfileId) => {
  if (!studentProfileId) return

  const sessionType =
    session.participantProfileIds.size > 1 ? 'group' : 'individual'

  await Profile.findByIdAndUpdate(studentProfileId, {
    $push: {
      testSessions: buildSessionRecord({
        sessionId: session.sessionId,
        sessionType,
        testType: session.testType,
        wordsToTest: session.wordsToTest,
        teacherProfileId: session.teacherProfileId,
        studentProfileId,
        startTime: session.startTime,
        fryLevel: session.fryLevel
      })
    }
  })

  session.persistedParticipants.add(studentProfileId)
}

const buildAssessmentRecord = (
  session,
  responseData,
  teacherNotes,
  recognized,
  score
) => ({
  testType: session.testType,
  words: [responseData.word],
  responses: [
    {
      word: responseData.word,
      correct: Boolean(recognized),
      timeSpent: responseData.responseTime || 0,
      attempts: 1
    }
  ],
  score: normalizeScore(score, Boolean(recognized)),
  duration: responseData.responseTime || 0,
  teacherNotes,
  assessmentData: {
    sessionType: 'teacher-led-live',
    response: responseData.response || null,
    confidence: responseData.confidence || 0,
    submittedRecognized: Boolean(responseData.recognized),
    teacherRecognized: Boolean(recognized),
    studentName: responseData.studentName || null
  },
  difficulty: 'medium',
  date: new Date(),
  sessionId: session.sessionId
})

const upsertStudentAssessment = async (
  studentProfileId,
  session,
  responseData,
  teacherNotes,
  recognized,
  score
) => {
  if (!studentProfileId || !responseData) return false

  const profile = await Profile.findById(studentProfileId)
  if (!profile) return false

  const assessmentRecord = buildAssessmentRecord(
    session,
    responseData,
    teacherNotes,
    recognized,
    score
  )

  const existingAssessment = profile.assessments.find(
    (assessment) =>
      assessment.sessionId === session.sessionId &&
      Array.isArray(assessment.words) &&
      assessment.words.length === 1 &&
      assessment.words[0] === responseData.word
  )

  if (existingAssessment) {
    existingAssessment.testType = assessmentRecord.testType
    existingAssessment.words = assessmentRecord.words
    existingAssessment.responses = assessmentRecord.responses
    existingAssessment.score = assessmentRecord.score
    existingAssessment.duration = assessmentRecord.duration
    existingAssessment.teacherNotes = assessmentRecord.teacherNotes
    existingAssessment.assessmentData = assessmentRecord.assessmentData
    existingAssessment.difficulty = assessmentRecord.difficulty
    existingAssessment.date = assessmentRecord.date
  } else {
    profile.assessments.push(assessmentRecord)
  }

  await profile.save()
  return true
}

const buildParticipantResults = (session, studentProfileId) => {
  const participantState = session.participants.get(studentProfileId)
  if (!participantState) {
    return {
      totalWords: session.wordsToTest.length,
      correctWords: 0,
      averageResponseTime: 0,
      averageConfidence: 0
    }
  }

  const responses = Array.from(participantState.responsesByWord.values())
  const completedResponses = responses.filter((response) => response.word)
  const correctWords = completedResponses.filter((response) =>
    typeof response.teacherRecognized === 'boolean'
      ? response.teacherRecognized
      : response.recognized
  ).length

  const responseTimes = completedResponses
    .map((response) => response.responseTime)
    .filter((value) => typeof value === 'number' && value >= 0)

  const confidences = completedResponses
    .map((response) => response.confidence)
    .filter((value) => typeof value === 'number' && value >= 0)

  return {
    totalWords: session.wordsToTest.length,
    correctWords,
    averageResponseTime: responseTimes.length
      ? responseTimes.reduce((sum, value) => sum + value, 0) /
        responseTimes.length
      : 0,
    averageConfidence: confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : 0
  }
}

const finalizeStudentSession = async (session, studentProfileId, endTime) => {
  if (!studentProfileId) return

  const results = buildParticipantResults(session, studentProfileId)

  const updatedProfile = await Profile.findOneAndUpdate(
    {
      _id: studentProfileId,
      'testSessions.sessionId': session.sessionId
    },
    {
      $set: {
        'testSessions.$.endTime': endTime,
        'testSessions.$.status': 'completed',
        'testSessions.$.results': results
      }
    },
    { new: true }
  )

  if (!updatedProfile) {
    const sessionType =
      session.participantProfileIds.size > 1 ? 'group' : 'individual'

    await Profile.findByIdAndUpdate(studentProfileId, {
      $push: {
        testSessions: buildSessionRecord({
          sessionId: session.sessionId,
          sessionType,
          testType: session.testType,
          wordsToTest: session.wordsToTest,
          teacherProfileId: session.teacherProfileId,
          studentProfileId,
          startTime: session.startTime,
          fryLevel: session.fryLevel,
          status: 'completed',
          endTime,
          results
        })
      }
    })
  }
}

export function handleTestingEvents(socket, io, allUsers) {
  // Teacher starts a new test session
  socket.on('start_test_session', async (data) => {
    try {
      const { sessionId, teacherId, room, testType, wordsToTest, fryLevel } =
        data

      // Validate required data
      if (!sessionId || !teacherId || !room || !testType || !wordsToTest) {
        socket.emit('test_error', {
          message: 'Missing required test session data'
        })
        return
      }

      console.log(
        `Teacher ${teacherId} starting test session ${sessionId} in room ${room}`
      )

      const teacher = allUsers.find((user) => user.id === socket.id)
      const teacherProfileId = getProfileId(teacher?.user) || teacherId
      const participantProfileIds = [
        ...new Set(
          allUsers
            .filter((user) => user.room === room && user.user?.role === 'student')
            .map((user) => getProfileId(user.user))
            .filter(Boolean)
        )
      ]

      const activeSession = {
        sessionId,
        room,
        teacherProfileId,
        testType,
        fryLevel,
        wordsToTest: [...wordsToTest],
        startTime: new Date(),
        participantProfileIds: new Set(participantProfileIds),
        persistedParticipants: new Set(),
        participants: new Map(
          participantProfileIds.map((profileId) => [
            profileId,
            createParticipantState()
          ])
        )
      }

      await Promise.all(
        participantProfileIds.map((profileId) =>
          createActiveStudentSessionRecord(activeSession, profileId)
        )
      )

      activeTestSessions.set(sessionId, activeSession)

      // Broadcast test session start to all students in the room
      socket.to(room).emit('test_session_started', {
        sessionId,
        teacherId: teacherProfileId,
        testType,
        fryLevel,
        wordsCount: wordsToTest.length,
        startTime: Date.now()
      })

      // Confirm to teacher
      socket.emit('test_session_confirmed', {
        sessionId,
        message: 'Test session started successfully',
        studentsNotified: true,
        persistedStudents: participantProfileIds.length
      })
    } catch (error) {
      console.error('Error in start_test_session:', error)
      socket.emit('test_error', { message: 'Failed to start test session' })
    }
  })

  // Teacher sends a specific word to test
  socket.on('send_test_word', (data) => {
    try {
      const { sessionId, word, testType, difficulty, room, sequence } = data

      // Validate required data
      if (!sessionId || !word || !testType || !room) {
        socket.emit('test_error', {
          message: 'Missing required word test data'
        })
        return
      }

      console.log(`Sending test word "${word}" to room ${room}`)

      // Send word to all students in the room
      socket.to(room).emit('receive_test_word', {
        sessionId,
        word,
        testType,
        difficulty: difficulty || 'medium',
        sequence: sequence || 1,
        timestamp: Date.now()
      })

      // Confirm to teacher
      socket.emit('word_sent_confirmation', {
        sessionId,
        word,
        sentAt: Date.now()
      })
    } catch (error) {
      console.error('Error in send_test_word:', error)
      socket.emit('test_error', { message: 'Failed to send test word' })
    }
  })

  // Student submits response to a test word
  socket.on('submit_test_response', async (data) => {
    try {
      const {
        sessionId,
        word,
        studentId,
        studentName,
        response,
        responseTime,
        testType,
        recognized,
        confidence
      } = data

      // Validate required data
      if (!sessionId || !word || !studentId || !testType) {
        socket.emit('test_error', { message: 'Missing required response data' })
        return
      }

      console.log(
        `Student ${studentName} submitted response for word "${word}"`
      )

      // Find the student's room
      const student = allUsers.find((user) => user.id === socket.id)
      if (!student) {
        socket.emit('test_error', { message: 'Student not found in room' })
        return
      }

      const studentProfileId = studentId || getProfileId(student.user)
      const activeSession = activeTestSessions.get(sessionId)
      const deliveryRoom = activeSession?.room || student.room

      if (activeSession && studentProfileId) {
        activeSession.participantProfileIds.add(studentProfileId)

        if (!activeSession.persistedParticipants.has(studentProfileId)) {
          await createActiveStudentSessionRecord(activeSession, studentProfileId)
        }

        const participantState = getOrCreateParticipantState(
          activeSession,
          studentProfileId
        )
        const existingResponse = participantState.responsesByWord.get(word) || {
          word,
          studentId: studentProfileId
        }

        participantState.responsesByWord.set(word, {
          ...existingResponse,
          word,
          studentId: studentProfileId,
          studentName,
          response: response || null,
          responseTime: responseTime || 0,
          testType,
          recognized: Boolean(recognized),
          confidence: typeof confidence === 'number' ? confidence : 0,
          submittedAt: new Date()
        })

        const latestResponse = participantState.responsesByWord.get(word)

        await upsertStudentAssessment(
          studentProfileId,
          activeSession,
          latestResponse,
          existingResponse.teacherNotes || '',
          typeof existingResponse.teacherRecognized === 'boolean'
            ? existingResponse.teacherRecognized
            : Boolean(recognized),
          typeof existingResponse.score === 'number'
            ? existingResponse.score
            : normalizeScore(undefined, Boolean(recognized))
        )
      }

      if (!deliveryRoom) {
        socket.emit('test_error', {
          message: 'Unable to deliver student response to the teacher'
        })
        return
      }

      // Send response to teacher (and other observers in the room)
      socket.to(deliveryRoom).emit('student_test_response', {
        sessionId,
        word,
        studentId: studentProfileId,
        studentName,
        response: response || null,
        responseTime,
        testType,
        recognized: recognized || false,
        confidence: confidence || 0,
        timestamp: Date.now()
      })

      // Confirm to student
      socket.emit('response_submitted', {
        sessionId,
        word,
        submittedAt: Date.now()
      })
    } catch (error) {
      console.error('Error in submit_test_response:', error)
      socket.emit('test_error', { message: 'Failed to submit response' })
    }
  })

  // Teacher saves assessment notes for a student's response
  socket.on('save_assessment_note', async (data) => {
    try {
      const {
        sessionId,
        word,
        studentId,
        teacherNotes,
        score,
        recognized,
        testType,
        response,
        responseTime,
        confidence,
        studentName
      } = data

      // Validate required data
      if (!sessionId || !word || !studentId) {
        socket.emit('test_error', {
          message: 'Missing required assessment data'
        })
        return
      }

      console.log(
        `Teacher saving assessment for student ${studentId}, word "${word}"`
      )

      // Find teacher's room
      const teacher = allUsers.find((user) => user.id === socket.id)
      if (!teacher) {
        socket.emit('test_error', { message: 'Teacher not found in room' })
        return
      }

      const activeSession = activeTestSessions.get(sessionId)
      const studentProfileId = studentId

      if (activeSession && studentProfileId) {
        activeSession.participantProfileIds.add(studentProfileId)

        if (!activeSession.persistedParticipants.has(studentProfileId)) {
          await createActiveStudentSessionRecord(activeSession, studentProfileId)
        }

        const participantState = getOrCreateParticipantState(
          activeSession,
          studentProfileId
        )
        const existingResponse = participantState.responsesByWord.get(word) || {
          word,
          studentId: studentProfileId,
          studentName,
          response: response || null,
          responseTime: responseTime || 0,
          testType: testType || activeSession.testType,
          confidence: confidence || 0,
          recognized: false
        }

        const updatedResponse = {
          ...existingResponse,
          teacherNotes,
          teacherRecognized: Boolean(recognized),
          score: normalizeScore(score, Boolean(recognized)),
          assessedAt: new Date()
        }

        participantState.responsesByWord.set(word, updatedResponse)

        await upsertStudentAssessment(
          studentProfileId,
          activeSession,
          updatedResponse,
          teacherNotes,
          recognized,
          score
        )
      }

      // Broadcast assessment saved to room (for any observers)
      socket.to(teacher.room).emit('assessment_saved', {
        sessionId,
        word,
        studentId: studentProfileId,
        teacherNotes,
        score,
        recognized,
        assessedAt: Date.now()
      })

      // Confirm to teacher
      socket.emit('assessment_note_saved', {
        sessionId,
        word,
        studentId: studentProfileId,
        savedAt: Date.now()
      })
    } catch (error) {
      console.error('Error in save_assessment_note:', error)
      socket.emit('test_error', { message: 'Failed to save assessment note' })
    }
  })

  // Teacher ends the test session
  socket.on('end_test_session', async (data) => {
    try {
      const { sessionId, room, completedCount, totalWords } = data

      // Validate required data
      if (!sessionId || !room) {
        socket.emit('test_error', {
          message: 'Missing required session end data'
        })
        return
      }

      console.log(`Ending test session ${sessionId} in room ${room}`)

      const activeSession = activeTestSessions.get(sessionId)
      const endTime = new Date()

      if (activeSession) {
        const participantProfileIds = [
          ...new Set([
            ...activeSession.participantProfileIds,
            ...activeSession.persistedParticipants
          ])
        ]

        await Promise.all(
          participantProfileIds.map((studentProfileId) =>
            finalizeStudentSession(activeSession, studentProfileId, endTime)
          )
        )

        activeTestSessions.delete(sessionId)
      }

      // Notify all users in room that session has ended
      socket.to(room).emit('test_session_ended', {
        sessionId,
        endTime: endTime.getTime(),
        completedCount: completedCount || 0,
        totalWords: totalWords || 0
      })

      // Confirm to teacher
      socket.emit('test_session_end_confirmed', {
        sessionId,
        endedAt: Date.now()
      })
    } catch (error) {
      console.error('Error in end_test_session:', error)
      socket.emit('test_error', { message: 'Failed to end test session' })
    }
  })

  // Student requests speech synthesis for a word
  socket.on('request_word_pronunciation', (data) => {
    try {
      const { word, studentId, sessionId } = data

      // Validate required data
      if (!word || !studentId) {
        socket.emit('test_error', { message: 'Missing word or student ID' })
        return
      }

      console.log(
        `Student ${studentId} requesting pronunciation for word "${word}"`
      )

      // Find student's room
      const student = allUsers.find((user) => user.id === socket.id)
      if (!student) {
        socket.emit('test_error', { message: 'Student not found' })
        return
      }

      // Send pronunciation request to teacher (they can choose to provide it)
      socket.to(student.room).emit('pronunciation_requested', {
        word,
        studentId,
        studentName: student.username,
        sessionId,
        requestedAt: Date.now()
      })

      // Send pronunciation directly to student
      socket.emit('word_pronunciation', {
        word,
        sessionId,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Error in request_word_pronunciation:', error)
      socket.emit('test_error', { message: 'Failed to request pronunciation' })
    }
  })

  // Teacher updates test session settings
  socket.on('update_test_settings', (data) => {
    try {
      const { sessionId, settings, room } = data

      // Validate required data
      if (!sessionId || !settings || !room) {
        socket.emit('test_error', { message: 'Missing test settings data' })
        return
      }

      console.log(`Updating test settings for session ${sessionId}`)

      // Broadcast settings update to all users in room
      socket.to(room).emit('test_settings_updated', {
        sessionId,
        settings,
        updatedAt: Date.now()
      })

      // Confirm to teacher
      socket.emit('test_settings_update_confirmed', {
        sessionId,
        updatedAt: Date.now()
      })
    } catch (error) {
      console.error('Error in update_test_settings:', error)
      socket.emit('test_error', { message: 'Failed to update test settings' })
    }
  })

  return {
    // Helper function to get active test sessions in a room
    getActiveTestSessions: (room) => {
      // This would typically query a database or cache
      // For now, return empty array
      return []
    },

    // Helper function to validate test session permissions
    validateTestPermissions: (userId, sessionId) => {
      // Check if user has permission to access/modify this test session
      return true // Simplified for now
    }
  }
}
