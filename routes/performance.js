/**
 * Performance monitoring routes
 * Provides endpoints for accessing performance metrics and health status
 */

import express from 'express'
import { performanceMonitor } from '../middleware/performanceMonitor.js'
import { decodeUserFromToken, checkAuth } from '../middleware/auth.js'

const router = express.Router()

/**
 * GET /api/performance/metrics
 * Get comprehensive performance metrics
 * Requires authentication
 */
router.get('/metrics', decodeUserFromToken, checkAuth, (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics()
    res.json({
      success: true,
      data: metrics
    })
  } catch (error) {
    console.error('Error fetching performance metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance metrics'
    })
  }
})

/**
 * GET /api/performance/health
 * Get system health status based on performance metrics
 * Public endpoint for monitoring tools
 */
router.get('/health', (req, res) => {
  try {
    const health = performanceMonitor.getHealthStatus()

    // Set appropriate HTTP status based on health
    let statusCode = 200
    if (health.status === 'warning') {
      statusCode = 200 // Still OK but with warnings
    } else if (health.status === 'critical') {
      statusCode = 503 // Service Unavailable
    }

    res.status(statusCode).json({
      success: true,
      data: health
    })
  } catch (error) {
    console.error('Error fetching health status:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch health status',
      data: {
        status: 'critical',
        checks: {
          server: { status: 'critical', message: 'Health check failed' }
        },
        timestamp: new Date().toISOString()
      }
    })
  }
})

/**
 * GET /api/performance/summary
 * Get summarized performance metrics for dashboard
 * Requires authentication
 */
router.get('/summary', decodeUserFromToken, checkAuth, (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics()

    // Create summarized view
    const summary = {
      requests: {
        total: metrics.requests.total,
        avgResponseTime: Math.round(metrics.requests.avgResponseTime),
        errorRate:
          metrics.requests.total > 0
            ? ((metrics.errors.count / metrics.requests.total) * 100).toFixed(2)
            : 0
      },
      system: {
        uptime: Math.round(metrics.system.uptime),
        memoryUsage: metrics.system.memoryUsage.percentage,
        cpuUsage: metrics.system.cpuUsage.percentage
      },
      database: {
        totalQueries: metrics.database.queries,
        avgQueryTime: Math.round(metrics.database.avgQueryTime)
      },
      topRoutes: Object.entries(metrics.requests.byRoute)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5)
        .map(([route, stats]) => ({
          route,
          requests: stats.count,
          avgTime: Math.round(stats.avgTime)
        })),
      topErrors: Object.entries(metrics.errors.byType)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([type, count]) => ({ type, count })),
      timestamp: metrics.timestamp
    }

    res.json({
      success: true,
      data: summary
    })
  } catch (error) {
    console.error('Error fetching performance summary:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance summary'
    })
  }
})

/**
 * POST /api/performance/reset
 * Reset performance metrics
 * Requires authentication and admin privileges
 */
router.post('/reset', decodeUserFromToken, checkAuth, (req, res) => {
  try {
    // Check if user has admin privileges (you might want to implement role-based auth)
    // For now, just check if user exists
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient privileges'
      })
    }

    performanceMonitor.resetMetrics()

    res.json({
      success: true,
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error resetting performance metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reset performance metrics'
    })
  }
})

/**
 * GET /api/performance/export
 * Export performance metrics as JSON file
 * Requires authentication
 */
router.get('/export', decodeUserFromToken, checkAuth, (req, res) => {
  try {
    const metrics = performanceMonitor.getMetrics()
    const filename = `performance-metrics-${
      new Date().toISOString().split('T')[0]
    }.json`

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    res.json(metrics)
  } catch (error) {
    console.error('Error exporting performance metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to export performance metrics'
    })
  }
})

/**
 * GET /api/performance/alerts
 * Get performance alerts based on thresholds
 * Requires authentication
 */
router.get('/alerts', decodeUserFromToken, checkAuth, (req, res) => {
  try {
    const health = performanceMonitor.getHealthStatus()
    const metrics = performanceMonitor.getMetrics()

    const alerts = []

    // Check for various alert conditions
    if (health.status === 'critical' || health.status === 'warning') {
      Object.entries(health.checks).forEach(([check, status]) => {
        if (status.status !== 'healthy') {
          alerts.push({
            type: status.status,
            category: check,
            message: `${check} is ${status.status}: ${status.value}`,
            threshold: status.threshold,
            timestamp: health.timestamp
          })
        }
      })
    }

    // Check for slow routes
    Object.entries(metrics.requests.byRoute).forEach(([route, stats]) => {
      if (stats.avgTime > 1000) {
        alerts.push({
          type: 'warning',
          category: 'slow_route',
          message: `Route ${route} has slow average response time: ${stats.avgTime.toFixed(
            2
          )}ms`,
          threshold: '1000ms',
          timestamp: metrics.timestamp
        })
      }
    })

    // Check for frequent errors
    Object.entries(metrics.errors.byRoute).forEach(([route, count]) => {
      const routeStats = metrics.requests.byRoute[route]
      if (routeStats && count / routeStats.count > 0.1) {
        // More than 10% error rate
        alerts.push({
          type: 'critical',
          category: 'high_error_rate',
          message: `Route ${route} has high error rate: ${(
            (count / routeStats.count) *
            100
          ).toFixed(2)}%`,
          threshold: '10%',
          timestamp: metrics.timestamp
        })
      }
    })

    res.json({
      success: true,
      data: {
        alerts,
        alertCount: alerts.length,
        criticalCount: alerts.filter((a) => a.type === 'critical').length,
        warningCount: alerts.filter((a) => a.type === 'warning').length
      }
    })
  } catch (error) {
    console.error('Error fetching performance alerts:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance alerts'
    })
  }
})

/**
 * GET /api/performance/baseline
 * Get performance baseline information
 * Requires authentication
 */
router.get('/baseline', decodeUserFromToken, checkAuth, (req, res) => {
  try {
    const baseline = performanceMonitor.baseline.generateReport()
    res.json({
      success: true,
      data: baseline
    })
  } catch (error) {
    console.error('Error fetching baseline metrics:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch baseline metrics'
    })
  }
})

/**
 * GET /api/performance/baseline/:endpoint
 * Get baseline for specific endpoint
 * Requires authentication
 */
router.get(
  '/baseline/:endpoint',
  decodeUserFromToken,
  checkAuth,
  (req, res) => {
    try {
      const { endpoint } = req.params
      const { method = 'GET' } = req.query

      const baseline = performanceMonitor.baseline.getBaseline(endpoint, method)

      if (!baseline) {
        return res.status(404).json({
          success: false,
          message: 'No baseline found for this endpoint'
        })
      }

      res.json({
        success: true,
        data: baseline
      })
    } catch (error) {
      console.error('Error fetching endpoint baseline:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch endpoint baseline'
      })
    }
  }
)

/**
 * POST /api/performance/baseline/reset
 * Reset performance baselines
 * Requires admin authentication
 */
router.post('/baseline/reset', decodeUserFromToken, checkAuth, (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user?.profile?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      })
    }

    performanceMonitor.baseline.resetBaselines()

    res.json({
      success: true,
      message: 'Performance baselines reset successfully'
    })
  } catch (error) {
    console.error('Error resetting baselines:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to reset baselines'
    })
  }
})

/**
 * PUT /api/performance/baseline/thresholds
 * Update performance thresholds
 * Requires admin authentication
 */
router.put(
  '/baseline/thresholds',
  decodeUserFromToken,
  checkAuth,
  (req, res) => {
    try {
      // Check if user has admin privileges
      if (!req.user?.profile?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin privileges required'
        })
      }

      const { thresholds } = req.body

      if (!thresholds || typeof thresholds !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Valid thresholds object required'
        })
      }

      performanceMonitor.baseline.setThresholds(thresholds)

      res.json({
        success: true,
        message: 'Performance thresholds updated successfully',
        data: performanceMonitor.baseline.thresholds
      })
    } catch (error) {
      console.error('Error updating thresholds:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update thresholds'
      })
    }
  }
)

export { router }
