import httpServer from "socket.io"
module.exports = {
  init: httpServer => {
    io = httpServer
    return io
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io is not initialized")
    }
    return io
  },
}