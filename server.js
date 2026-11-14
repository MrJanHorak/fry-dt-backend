import 'dotenv/config.js'

import express from 'express'
import logger from 'morgan'
import cors from 'cors'
import helmet from 'helmet'

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
import { decodeUserFromToken, checkAuth } from './middleware/auth.js'
import { requireAdmin } from './middleware/authorize.js'

// connect to MongoDB unless a test run explicitly disables it
if (process.env.SKIP_DB_CONNECTION !== 'true') {
  import('./config/database.js')
}

if (process.env.NODE_ENV === 'production' && !process.env.SECRET) {
  throw new Error('SECRET must be set in production')
}

// create the express app
const app = express()

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1)
}

export const allowedOrigins = [
  ...(process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:5173'
      ]),
  ...(process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
]

app.use(helmet())
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
)

app.use(logger(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

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

// Operational/monitoring endpoints are admin-only (their /health stays public)
const adminOnlyExceptHealth = (req, res, next) => {
  if (req.method === 'GET' && req.path === '/health') return next()
  checkAuth(req, res, () => requireAdmin(req, res, next))
}

// routes
app.use('/api/auth', authRouter)
app.use('/api/profiles', profilesRouter)
app.use(
  '/api/performance',
  decodeUserFromToken,
  adminOnlyExceptHealth,
  performanceRouter
)
app.use(
  '/api/database',
  decodeUserFromToken,
  adminOnlyExceptHealth,
  databaseRouter
)
app.use('/api/ux', decodeUserFromToken, adminOnlyExceptHealth, uxRouter)

// Error tracking middleware (before error handlers)
app.use(errorTrackingMiddleware)

// 404 handler
app.use(notFoundHandler)

// Global error handler
app.use(errorHandler)

export { app }
