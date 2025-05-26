import 'dotenv/config.js'

import express from 'express'
import logger from 'morgan'
import cors from 'cors'

// import routes
import { router as authRouter } from './routes/auth.js'
import { router as profilesRouter } from './routes/profiles.js'
import { router as performanceRouter } from './routes/performance.js'
import { router as databaseRouter } from './routes/database.js'
import { router as uxRouter } from './routes/ux.js'

// import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import {
  performanceMiddleware,
  errorTrackingMiddleware
} from './middleware/performanceMonitor.js'

// connect to MondgoDB with mongoose
import('./config/database.js')

// create the express app
const app = express()

// Configure CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  })
)

app.use(logger('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Performance monitoring middleware
app.use(performanceMiddleware)

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// routes
app.use('/api/auth', authRouter)
app.use('/api/profiles', profilesRouter)
app.use('/api/performance', performanceRouter)
app.use('/api/database', databaseRouter)
app.use('/api/ux', uxRouter)

// Error tracking middleware (before error handlers)
app.use(errorTrackingMiddleware)

// 404 handler
app.use(notFoundHandler)

// Global error handler
app.use(errorHandler)

export { app }
