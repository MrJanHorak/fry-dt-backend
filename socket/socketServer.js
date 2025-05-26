/**
 * Main socket server configuration
 * Centralizes socket.io setup and event handling
 */

import { Server } from 'socket.io'
import { leaveRoom } from '../utils/leave-room.js'
import { handleChatEvents } from './chatHandlers.js'
import { handleStatusEvents } from './statusHandlers.js'

export function initializeSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  })

  let allUsers = [] // All users across all rooms

  // Listen for client connections
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`)

    // Initialize chat handlers
    const chatHandlers = handleChatEvents(socket, io, allUsers)

    // Initialize status handlers
    const statusHandlers = handleStatusEvents(socket, io, allUsers)

    // Handle user disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`)

      try {
        // Find and remove the user
        const disconnectedUser = chatHandlers.removeUser(socket.id)

        if (disconnectedUser) {
          // Leave the room properly
          leaveRoom(disconnectedUser, allUsers)

          // Notify other users in the room
          socket
            .to(disconnectedUser.room)
            .emit(
              'chatroom_users',
              chatHandlers.getUsersInRoom(disconnectedUser.room)
            )

          // Send disconnect message
          socket.to(disconnectedUser.room).emit('receive_message', {
            username: 'ChatBot',
            message: `${disconnectedUser.username} has left the chat`,
            __createdtime__: Date.now()
          })
        }
      } catch (error) {
        console.error('Error handling disconnect:', error)
      }
    })

    // Handle connection errors
    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    // Periodically clean up inactive users (every 5 minutes)
    const cleanupInterval = setInterval(() => {
      statusHandlers.cleanupInactiveUsers()
    }, 300000) // 5 minutes

    // Clear interval when socket disconnects
    socket.on('disconnect', () => {
      clearInterval(cleanupInterval)
    })
  })

  return io
}
