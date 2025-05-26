/**
 * Database Optimization API Routes
 * Provides endpoints for database performance monitoring and optimization
 */

import { Router } from 'express'
import { dbOptimizer } from '../config/database.js'
import { checkAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

/**
 * GET /api/database/health
 * Get database health status
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    if (!dbOptimizer) {
      return res.status(503).json({
        error: 'Database optimizer not initialized',
        status: 'unavailable'
      })
    }

    const healthCheck = await dbOptimizer.performHealthCheck()

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      health: healthCheck
    })
  })
)

/**
 * GET /api/database/indexes
 * Get database indexes information
 */
router.get(
  '/indexes',
  checkAuth,
  asyncHandler(async (req, res) => {
    if (!dbOptimizer) {
      return res.status(503).json({
        error: 'Database optimizer not initialized'
      })
    }

    res.json({
      indexes: dbOptimizer.indexes,
      isOptimized: dbOptimizer.isOptimized,
      timestamp: new Date().toISOString()
    })
  })
)

/**
 * GET /api/database/query-stats
 * Get query performance statistics
 */
router.get(
  '/query-stats',
  checkAuth,
  asyncHandler(async (req, res) => {
    if (!dbOptimizer) {
      return res.status(503).json({
        error: 'Database optimizer not initialized'
      })
    }

    const stats = dbOptimizer.getQueryStats()

    res.json({
      queryStatistics: stats,
      timestamp: new Date().toISOString()
    })
  })
)

/**
 * GET /api/database/performance
 * Get comprehensive performance analysis
 */
router.get(
  '/performance',
  checkAuth,
  asyncHandler(async (req, res) => {
    if (!dbOptimizer) {
      return res.status(503).json({
        error: 'Database optimizer not initialized'
      })
    }

    const performance = await dbOptimizer.analyzeQueries()

    res.json({
      performance,
      timestamp: new Date().toISOString()
    })
  })
)

/**
 * GET /api/database/report
 * Get complete optimization report
 */
router.get(
  '/report',
  checkAuth,
  asyncHandler(async (req, res) => {
    if (!dbOptimizer) {
      return res.status(503).json({
        error: 'Database optimizer not initialized'
      })
    }

    const report = await dbOptimizer.generateOptimizationReport()

    res.json({
      report,
      timestamp: new Date().toISOString()
    })
  })
)

/**
 * POST /api/database/optimize
 * Trigger database optimization
 */
router.post(
  '/optimize',
  checkAuth,
  asyncHandler(async (req, res) => {
    if (!dbOptimizer) {
      return res.status(503).json({
        error: 'Database optimizer not initialized'
      })
    }

    // Check if user has admin privileges
    if (!req.user?.profile?.isAdmin) {
      return res.status(403).json({
        error: 'Admin privileges required for database optimization'
      })
    }

    try {
      await dbOptimizer.optimizeCollections()
      const report = await dbOptimizer.generateOptimizationReport()

      res.json({
        message: 'Database optimization completed',
        report,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Database optimization error:', error)
      res.status(500).json({
        error: 'Database optimization failed',
        details: error.message
      })
    }
  })
)

/**
 * POST /api/database/create-indexes
 * Recreate database indexes
 */
router.post(
  '/create-indexes',
  checkAuth,
  asyncHandler(async (req, res) => {
    if (!dbOptimizer) {
      return res.status(503).json({
        error: 'Database optimizer not initialized'
      })
    }

    // Check if user has admin privileges
    if (!req.user?.profile?.isAdmin) {
      return res.status(403).json({
        error: 'Admin privileges required for index creation'
      })
    }

    try {
      const indexes = await dbOptimizer.createIndexes()

      res.json({
        message: 'Database indexes created successfully',
        indexes,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Index creation error:', error)
      res.status(500).json({
        error: 'Index creation failed',
        details: error.message
      })
    }
  })
)

/**
 * GET /api/database/recommendations
 * Get optimization recommendations
 */
router.get(
  '/recommendations',
  checkAuth,
  asyncHandler(async (req, res) => {
    if (!dbOptimizer) {
      return res.status(503).json({
        error: 'Database optimizer not initialized'
      })
    }

    const performance = await dbOptimizer.analyzeQueries()
    const recommendations =
      dbOptimizer.generatePerformanceRecommendations(performance)

    res.json({
      recommendations,
      timestamp: new Date().toISOString()
    })
  })
)

export { router }
