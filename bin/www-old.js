/**
 * Module dependencies.
 */

import { app } from '../server.js'
import debug from 'debug'
import http from 'http'
import { initializeSocketServer } from '../socket/socketServer.js'

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '3001')
app.set('port', port)

/**
 * Create HTTP server.
 */

const server = http.createServer(app)

/**
 * Initialize Socket.IO server
 */
const io = initializeSocketServer(server)
    })
    // Send welcome msg to user that just joined chat only
    socket.emit('receive_message', {
      message: `Welcome ${username}`,
      username: CHAT_BOT,
      __createdtime__
    })
    // Save the new user to the room
    chatRoom = room
    allUsers.push({ id: socket.id, username, room, user })
    let chatRoomUsers = allUsers.filter((user) => user.room === room)
    socket.to(room).emit('chatroom_users', chatRoomUsers)
    socket.emit('chatroom_users', chatRoomUsers)

    console.log(`${username} has joined the chat`)

  })

  socket.on('send_message', (data) => {
    const { message, username, room, userRole, __createdtime__ } = data
    io.in(room).emit('receive_message', data) // Send to all users in room, including sender
  })
  socket.on('send_status', (data) => {
    const { message, username, room, userRole, __createdtime__ } = data
    io.in(room).emit('receive_status', data) // Send to all users in room, including sender
  })

  socket.on('leave_room', (data) => {
    const { username, room } = data
    socket.leave(room)
    const __createdtime__ = Date.now()
    // Remove user from memory
    allUsers = leaveRoom(socket.id, allUsers)
    socket.to(room).emit('chatroom_users', allUsers)
    socket.to(room).emit('receive_message', {
      username: CHAT_BOT,
      message: `${username} has left the chat`,
      __createdtime__
    })
    console.log(`${username} has left the chat`)
  })

  socket.on('disconnect', () => {
    console.log('User disconnected from the chat')
    const user = allUsers.find((user) => user.id == socket.id)
    if (user?.username) {
      allUsers = leaveRoom(socket.id, allUsers)
      socket.to(chatRoom).emit('chatroom_users', allUsers)
      socket.to(chatRoom).emit('receive_message', {
        message: `${user.username} has disconnected from the chat.`
      })
    }
  })
})

server.listen(port)
server.on('error', onError)
server.on('listening', onListening)

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10)

  if (isNaN(port)) {
    // named pipe
    return val
  }

  if (port >= 0) {
    // port number
    return port
  }

  return false
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`)
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`)
      process.exit(1)
      break
    default:
      throw error
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  const addr = server.address()
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`
  debug(`Listening on ${bind}`)
  console.log(`Listening on ${bind}`)
}
