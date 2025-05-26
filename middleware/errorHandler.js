/**
 * Global error handling middleware
 * This middleware catches all errors that occur in the application
 * and sends a consistent error response to the client
 */

export function errorHandler(err, req, res, next) {
  console.error('Error stack:', err.stack)

  // Default error response
  let statusCode = 500
  let message = 'Internal Server Error'

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400
    message =
      'Validation Error: ' +
      Object.values(err.errors)
        .map((e) => e.message)
        .join(', ')
  } else if (err.name === 'CastError') {
    statusCode = 400
    message = 'Invalid ID format'
  } else if (err.code === 11000) {
    statusCode = 409
    message = 'Duplicate key error'
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    message = 'Invalid token'
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message = 'Token expired'
  } else if (err.message) {
    message = err.message
  }

  // Set status code if it was explicitly set on the error
  if (err.statusCode) {
    statusCode = err.statusCode
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  })
}

/**
 * 404 handler for routes that don't exist
 */
export function notFoundHandler(req, res, next) {
  const error = new Error(`Route ${req.originalUrl} not found`)
  error.statusCode = 404
  next(error)
}

/**
 * Async error wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
