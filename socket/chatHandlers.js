/**
 * Chat socket handlers
 * Handles all chat-related socket events
 */

const CHAT_BOT = 'ChatBot'

export function handleChatEvents(socket, io, allUsers) {
  // Add a user to a room
  socket.on('join_room', (data) => {
    try {
      const { username, user, room } = data
      const existingUser = allUsers.find(
        (roomUser) => roomUser.id === socket.id
      )
      const previousRoom = existingUser?.room || null

      if (previousRoom && previousRoom !== room) {
        socket.leave(previousRoom)
      }

      socket.join(room)

      let __createdtime__ = Date.now()

      // Send message to all users currently in the room, apart from the user that just joined
      socket.to(room).emit('receive_message', {
        message: `${username} has joined the chat room`,
        username: CHAT_BOT,
        user: user,
        __createdtime__
      })

      // Save the new user to the room
      if (!existingUser) {
        const newUser = { username, user, room, id: socket.id }
        allUsers.push(newUser)
      } else {
        existingUser.username = username
        existingUser.user = user
        existingUser.room = room
        existingUser.lastActivity = Date.now()
      }

      if (previousRoom && previousRoom !== room) {
        io.in(previousRoom).emit(
          'chatroom_users',
          allUsers.filter((roomUser) => roomUser.room === previousRoom)
        )
      }

      // Send list of users in room to client
      io.in(room).emit(
        'chatroom_users',
        allUsers.filter((user) => user.room === room)
      )

      // Send welcome message to user that just joined
      socket.emit('receive_message', {
        message: `Welcome ${username}`,
        username: CHAT_BOT,
        user: user,
        __createdtime__
      })
    } catch (error) {
      console.error('Error in join_room:', error)
      socket.emit('error', { message: 'Failed to join room' })
    }
  })

  // Listen for when a message is sent
  socket.on('send_message', (data) => {
    try {
      const { message, username, user, room, __createdtime__ } = data

      // Validate message data
      if (!message || !username || !room) {
        socket.emit('error', { message: 'Invalid message data' })
        return
      }

      // Send message to all users in room
      io.in(room).emit('receive_message', data)
    } catch (error) {
      console.error('Error in send_message:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  socket.on('request_room_users', (data) => {
    try {
      const { room } = data || {}

      if (!room) {
        socket.emit('error', { message: 'Room is required' })
        return
      }

      socket.emit(
        'chatroom_users',
        allUsers.filter((user) => user.room === room)
      )
    } catch (error) {
      console.error('Error in request_room_users:', error)
      socket.emit('error', { message: 'Failed to load room users' })
    }
  })

  return {
    // Helper function to get users in a specific room
    getUsersInRoom: (room) => allUsers.filter((user) => user.room === room),

    // Helper function to remove user from allUsers array
    removeUser: (socketId) => {
      const index = allUsers.findIndex((user) => user.id === socketId)
      if (index !== -1) {
        return allUsers.splice(index, 1)[0]
      }
      return null
    }
  }
}
