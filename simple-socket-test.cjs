#!/usr/bin/env node

/**
 * Simple Socket Connection Test (CommonJS)
 * Tests basic socket connectivity to verify our fix works
 */

const { io } = require('socket.io-client')

const SOCKET_URL = 'http://localhost:3000'

console.log('🔧 Testing Socket Connection...\n')

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  timeout: 10000
})

socket.on('connect', () => {
  console.log('✅ Socket connected successfully!')
  console.log('   Socket ID:', socket.id)
  console.log('   Connected to:', SOCKET_URL)
  
  // Test room joining
  socket.emit('join_room', {
    username: 'Test User',
    user: { name: 'Test User', role: 'teacher' },
    room: 'test-room'
  })
  
  console.log('   📤 Sent join_room event')
})

socket.on('chatroom_users', (users) => {
  console.log('✅ Received chatroom_users event')
  console.log('   Users in room:', users.length)
  
  // Test complete, disconnect
  setTimeout(() => {
    socket.disconnect()
    console.log('\n🎯 Socket test completed successfully!')
    console.log('✅ Backend socket server is working!')
    process.exit(0)
  }, 1000)
})

socket.on('connect_error', (error) => {
  console.log('❌ Socket connection failed:', error.message)
  process.exit(1)
})

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket disconnected:', reason)
})

// Timeout after 10 seconds
setTimeout(() => {
  console.log('❌ Socket connection test timeout')
  process.exit(1)
}, 10000)
