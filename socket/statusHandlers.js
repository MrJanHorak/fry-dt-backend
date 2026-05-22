/**
 * Status socket handlers
 * Handles all status-related socket events for user presence and activities
 */

const presenceByProfileId = new Map()
const socketToProfileId = new Map()

const getProfileId = (userLike, explicitProfileId = null) => {
  if (explicitProfileId) return explicitProfileId
  if (!userLike) return null

  if (typeof userLike === 'string') {
    return userLike
  }

  return userLike.profile || userLike._id || userLike.id || null
}

const serializePresenceEntry = (entry) => ({
  profileId: entry.profileId,
  name: entry.name,
  role: entry.role,
  status: entry.status,
  currentPath: entry.currentPath,
  context: entry.context,
  practiceMode: entry.practiceMode,
  practiceSessionActive: Boolean(entry.practiceSessionActive),
  currentWord: entry.currentWord,
  wordsCompleted: entry.wordsCompleted,
  totalWords: entry.totalWords,
  isListening: Boolean(entry.isListening),
  room: entry.room,
  invitedRoom: entry.invitedRoom,
  lastActivity: entry.lastActivity,
  socketCount: entry.socketIds.size
})

export function handleStatusEvents(socket, io, allUsers) {
  const emitPresenceUpdate = (profileId) => {
    const presenceEntry = presenceByProfileId.get(profileId)
    if (!presenceEntry) return null

    const serializedEntry = serializePresenceEntry(presenceEntry)
    io.emit('presence_updated', serializedEntry)
    return serializedEntry
  }

  const getPresenceSnapshot = () =>
    Array.from(presenceByProfileId.values()).map(serializePresenceEntry)

  const upsertPresence = (data = {}) => {
    const profileId = getProfileId(data.user, data.profileId)
    if (!profileId) return null

    const existingEntry = presenceByProfileId.get(profileId) || {
      profileId,
      socketIds: new Set(),
      name: data.user?.name || data.name || 'Unknown User',
      role: data.user?.role || data.role || null,
      status: 'online',
      currentPath: null,
      context: 'online',
      practiceMode: null,
      practiceSessionActive: false,
      currentWord: null,
      wordsCompleted: 0,
      totalWords: 0,
      isListening: false,
      room: null,
      invitedRoom: null,
      lastActivity: Date.now()
    }

    existingEntry.socketIds.add(socket.id)
    existingEntry.name = data.user?.name || data.name || existingEntry.name
    existingEntry.role = data.user?.role || data.role || existingEntry.role
    existingEntry.status = data.status || 'online'
    existingEntry.currentPath = Object.prototype.hasOwnProperty.call(
      data,
      'currentPath'
    )
      ? data.currentPath
      : existingEntry.currentPath
    existingEntry.context = data.context || existingEntry.context || 'online'
    existingEntry.practiceMode = Object.prototype.hasOwnProperty.call(
      data,
      'practiceMode'
    )
      ? data.practiceMode
      : existingEntry.practiceMode
    existingEntry.practiceSessionActive =
      typeof data.practiceSessionActive === 'boolean'
        ? data.practiceSessionActive
        : existingEntry.practiceSessionActive
    existingEntry.currentWord = Object.prototype.hasOwnProperty.call(
      data,
      'currentWord'
    )
      ? data.currentWord
      : existingEntry.currentWord
    existingEntry.wordsCompleted =
      typeof data.wordsCompleted === 'number'
        ? data.wordsCompleted
        : existingEntry.wordsCompleted ?? 0
    existingEntry.totalWords =
      typeof data.totalWords === 'number'
        ? data.totalWords
        : existingEntry.totalWords ?? 0
    existingEntry.isListening =
      typeof data.isListening === 'boolean'
        ? data.isListening
        : existingEntry.isListening
    existingEntry.room = Object.prototype.hasOwnProperty.call(data, 'room')
      ? data.room
      : existingEntry.room
    existingEntry.invitedRoom = Object.prototype.hasOwnProperty.call(
      data,
      'invitedRoom'
    )
      ? data.invitedRoom
      : existingEntry.invitedRoom
    existingEntry.lastActivity = Date.now()

    presenceByProfileId.set(profileId, existingEntry)
    socketToProfileId.set(socket.id, profileId)

    return emitPresenceUpdate(profileId)
  }

  const removePresence = (socketId) => {
    const profileId = socketToProfileId.get(socketId)
    if (!profileId) return null

    const presenceEntry = presenceByProfileId.get(profileId)
    socketToProfileId.delete(socketId)

    if (!presenceEntry) return null

    presenceEntry.socketIds.delete(socketId)

    if (presenceEntry.socketIds.size === 0) {
      presenceByProfileId.delete(profileId)
      io.emit('presence_removed', { profileId })
      return { profileId }
    }

    presenceEntry.lastActivity = Date.now()
    return emitPresenceUpdate(profileId)
  }

  // Handle user status updates (online, offline, typing, etc.)
  socket.on('update_status', (data) => {
    try {
      const { status, room, user } = data

      // Find user in allUsers array
      const userIndex = allUsers.findIndex((u) => u.id === socket.id)
      if (userIndex !== -1) {
        allUsers[userIndex].status = status
        allUsers[userIndex].lastActivity = Date.now()
      }

      upsertPresence({
        ...data,
        status,
        context: data.context || status || 'online'
      })

      // Broadcast status update to all users in the room
      if (room) {
        socket.to(room).emit('user_status_update', {
          user,
          status,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.error('Error in update_status:', error)
    }
  })

  socket.on('register_presence', (data) => {
    try {
      upsertPresence({ ...data, status: 'online' })
    } catch (error) {
      console.error('Error in register_presence:', error)
    }
  })

  socket.on('update_presence', (data) => {
    try {
      upsertPresence({ ...data, status: data.status || 'online' })
    } catch (error) {
      console.error('Error in update_presence:', error)
    }
  })

  socket.on('request_presence_snapshot', () => {
    try {
      socket.emit('presence_snapshot', getPresenceSnapshot())
    } catch (error) {
      console.error('Error in request_presence_snapshot:', error)
    }
  })

  socket.on('unregister_presence', () => {
    try {
      removePresence(socket.id)
    } catch (error) {
      console.error('Error in unregister_presence:', error)
    }
  })

  socket.on('request_testing_center_invite', (data) => {
    try {
      const { studentProfileIds = [], room, teacherId, teacherName } = data

      if (!room || !Array.isArray(studentProfileIds) || !studentProfileIds.length) {
        socket.emit('testing_center_invite_result', {
          room,
          results: [],
          error: 'Room and at least one student are required'
        })
        return
      }

      const invitation = {
        room,
        teacherId,
        teacherName,
        sentAt: Date.now()
      }

      const results = studentProfileIds.map((studentProfileId) => {
        const presenceEntry = presenceByProfileId.get(studentProfileId)

        if (!presenceEntry) {
          return { profileId: studentProfileId, delivered: false }
        }

        presenceEntry.invitedRoom = room
        presenceEntry.context = 'testing-invite'
        presenceEntry.lastActivity = Date.now()

        presenceEntry.socketIds.forEach((socketId) => {
          io.to(socketId).emit('testing_center_invitation', invitation)
        })

        emitPresenceUpdate(studentProfileId)

        return {
          profileId: studentProfileId,
          delivered: true,
          socketCount: presenceEntry.socketIds.size
        }
      })

      socket.emit('testing_center_invite_result', {
        room,
        results,
        sentAt: invitation.sentAt
      })
    } catch (error) {
      console.error('Error in request_testing_center_invite:', error)
      socket.emit('testing_center_invite_result', {
        room: data?.room,
        results: [],
        error: 'Failed to send testing center invites'
      })
    }
  })

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    try {
      const { room, username } = data
      socket.to(room).emit('user_typing', { username, isTyping: true })
    } catch (error) {
      console.error('Error in typing_start:', error)
    }
  })

  socket.on('typing_stop', (data) => {
    try {
      const { room, username } = data
      socket.to(room).emit('user_typing', { username, isTyping: false })
    } catch (error) {
      console.error('Error in typing_stop:', error)
    }
  })

  // Handle user activity tracking
  socket.on('user_activity', (data) => {
    try {
      const { activity, room, user } = data

      // Update user's last activity
      const userIndex = allUsers.findIndex((u) => u.id === socket.id)
      if (userIndex !== -1) {
        allUsers[userIndex].lastActivity = Date.now()
        allUsers[userIndex].currentActivity = activity
      }

      upsertPresence({
        ...data,
        context: activity?.type || data.context || 'active'
      })

      // Broadcast activity to room (if needed)
      if (room && activity.broadcast) {
        socket.to(room).emit('user_activity_update', {
          user,
          activity: activity.type,
          timestamp: Date.now()
        })
      }
    } catch (error) {
      console.error('Error in user_activity:', error)
    }
  })

  return {
    removePresence,

    // Get active users (users who have been active recently)
    getActiveUsers: (room, timeoutMs = 300000) => {
      // 5 minutes timeout
      const now = Date.now()
      return allUsers.filter(
        (user) =>
          user.room === room && now - (user.lastActivity || 0) < timeoutMs
      )
    },

    // Clean up inactive users
    cleanupInactiveUsers: (timeoutMs = 600000) => {
      // 10 minutes timeout
      const now = Date.now()
      const activeUsers = allUsers.filter(
        (user) => now - (user.lastActivity || 0) < timeoutMs
      )

      // Update allUsers array
      allUsers.length = 0
      allUsers.push(...activeUsers)

      return activeUsers
    }
  }
}
