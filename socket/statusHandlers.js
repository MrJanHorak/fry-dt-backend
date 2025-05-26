/**
 * Status socket handlers
 * Handles all status-related socket events for user presence and activities
 */

export function handleStatusEvents(socket, io, allUsers) {
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

      // Broadcast status update to all users in the room
      socket.to(room).emit('user_status_update', {
        user,
        status,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error('Error in update_status:', error)
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

      // Broadcast activity to room (if needed)
      if (activity.broadcast) {
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
