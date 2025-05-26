/**
 * Testing socket handlers
 * Handles all real-time testing-related socket events for teacher-student testing
 */

export function handleTestingEvents(socket, io, allUsers) {
  // Teacher starts a new test session
  socket.on('start_test_session', (data) => {
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

      // Broadcast test session start to all students in the room
      socket.to(room).emit('test_session_started', {
        sessionId,
        teacherId,
        testType,
        fryLevel,
        wordsCount: wordsToTest.length,
        startTime: Date.now()
      })

      // Confirm to teacher
      socket.emit('test_session_confirmed', {
        sessionId,
        message: 'Test session started successfully',
        studentsNotified: true
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
  socket.on('submit_test_response', (data) => {
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

      // Send response to teacher (and other observers in the room)
      socket.to(student.room).emit('student_test_response', {
        sessionId,
        word,
        studentId,
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
  socket.on('save_assessment_note', (data) => {
    try {
      const { sessionId, word, studentId, teacherNotes, score, recognized } =
        data

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

      // Broadcast assessment saved to room (for any observers)
      socket.to(teacher.room).emit('assessment_saved', {
        sessionId,
        word,
        studentId,
        teacherNotes,
        score,
        recognized,
        assessedAt: Date.now()
      })

      // Confirm to teacher
      socket.emit('assessment_note_saved', {
        sessionId,
        word,
        studentId,
        savedAt: Date.now()
      })
    } catch (error) {
      console.error('Error in save_assessment_note:', error)
      socket.emit('test_error', { message: 'Failed to save assessment note' })
    }
  })

  // Teacher ends the test session
  socket.on('end_test_session', (data) => {
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

      // Notify all users in room that session has ended
      socket.to(room).emit('test_session_ended', {
        sessionId,
        endTime: Date.now(),
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
