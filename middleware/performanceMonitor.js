/**
 * Performance monitoring middleware for Express.js
 * Tracks request metrics, response times, memory usage, and system health
 */

import os from 'os'
import process from 'process'
import { PerformanceBaseline } from '../services/performance-baseline.js'

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byRoute: {},
        byStatusCode: {},
        avgResponseTime: 0,
        totalResponseTime: 0
      },
      system: {
        uptime: 0,
        memoryUsage: {},
        cpuUsage: {},
        loadAverage: []
      },
      database: {
        queries: 0,
        queryTime: 0,
        avgQueryTime: 0
      },
      errors: {
        count: 0,
        byType: {},
        byRoute: {}
      }
    }

    this.startTime = Date.now()
    this.lastCpuUsage = process.cpuUsage()

    // Initialize performance baseline system
    this.baseline = new PerformanceBaseline()

    // Update system metrics every 30 seconds
    setInterval(() => {
      this.updateSystemMetrics()
    }, 30000)
  }

  /**
   * Express middleware for tracking request performance
   */
  middleware() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint()
      const startMemory = process.memoryUsage()

      // Track request start
      this.metrics.requests.total++

      // Track by method
      if (!this.metrics.requests.byMethod[req.method]) {
        this.metrics.requests.byMethod[req.method] = 0
      }
      this.metrics.requests.byMethod[req.method]++

      // Track by route (clean route without params)
      const route = this.getCleanRoute(req.route?.path || req.path)
      if (!this.metrics.requests.byRoute[route]) {
        this.metrics.requests.byRoute[route] = {
          count: 0,
          totalTime: 0,
          avgTime: 0
        }
      }
      this.metrics.requests.byRoute[route].count++

      // Override res.end to capture response metrics
      const originalEnd = res.end
      res.end = function (...args) {
        const endTime = process.hrtime.bigint()
        const responseTime = Number(endTime - startTime) / 1000000 // Convert to milliseconds
        const endMemory = process.memoryUsage()

        // Update response time metrics
        that.metrics.requests.totalResponseTime += responseTime
        that.metrics.requests.avgResponseTime =
          that.metrics.requests.totalResponseTime / that.metrics.requests.total

        // Update route-specific metrics
        that.metrics.requests.byRoute[route].totalTime += responseTime
        that.metrics.requests.byRoute[route].avgTime =
          that.metrics.requests.byRoute[route].totalTime /
          that.metrics.requests.byRoute[route].count

        // Track by status code
        if (!that.metrics.requests.byStatusCode[res.statusCode]) {
          that.metrics.requests.byStatusCode[res.statusCode] = 0
        }
        that.metrics.requests.byStatusCode[res.statusCode]++

        // Track memory usage
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed

        // Add performance headers
        res.set({
          'X-Response-Time': `${responseTime.toFixed(2)}ms`,
          'X-Memory-Delta': `${memoryDelta}`,
          'X-Request-ID': req.headers['x-request-id'] || `req-${Date.now()}`
        })

        // Record measurement in baseline system
        that.baseline.recordMeasurement(route, responseTime, {
          method: req.method,
          statusCode: res.statusCode,
          userAgent: req.headers['user-agent'],
          memoryDelta,
          path: req.path
        })

        // Check for performance deviations
        const deviation = that.baseline.checkPerformanceDeviation(
          route,
          responseTime,
          {
            method: req.method,
            statusCode: res.statusCode
          }
        )

        if (deviation.hasDeviation) {
          console.warn(
            `Performance deviation detected: ${req.method} ${req.path}`
          )
          console.warn(
            `  Expected: ~${Math.round(
              deviation.baseline
            )}ms, Actual: ${Math.round(responseTime)}ms`
          )
          console.warn(
            `  Deviation: ${deviation.deviation}% (${deviation.reason})`
          )
        }

        // Log slow requests (>1000ms)
        if (responseTime > 1000) {
          console.warn(
            `Slow request detected: ${req.method} ${
              req.path
            } - ${responseTime.toFixed(2)}ms`
          )
        }

        originalEnd.apply(this, args)
      }

      const that = this
      next()
    }
  }

  /**
   * Error tracking middleware
   */
  errorMiddleware() {
    return (err, req, res, next) => {
      this.metrics.errors.count++

      // Track by error type
      const errorType = err.name || 'UnknownError'
      if (!this.metrics.errors.byType[errorType]) {
        this.metrics.errors.byType[errorType] = 0
      }
      this.metrics.errors.byType[errorType]++

      // Track by route
      const route = this.getCleanRoute(req.route?.path || req.path)
      if (!this.metrics.errors.byRoute[route]) {
        this.metrics.errors.byRoute[route] = 0
      }
      this.metrics.errors.byRoute[route]++

      next(err)
    }
  }

  /**
   * Database query tracking
   */
  trackDatabaseQuery(queryTime) {
    this.metrics.database.queries++
    this.metrics.database.queryTime += queryTime
    this.metrics.database.avgQueryTime =
      this.metrics.database.queryTime / this.metrics.database.queries
  }

  /**
   * Update system-level metrics
   */
  updateSystemMetrics() {
    // System uptime
    this.metrics.system.uptime = process.uptime()

    // Memory usage
    this.metrics.system.memoryUsage = {
      ...process.memoryUsage(),
      free: os.freemem(),
      total: os.totalmem(),
      percentage: (
        ((os.totalmem() - os.freemem()) / os.totalmem()) *
        100
      ).toFixed(2)
    }

    // CPU usage
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage)
    this.metrics.system.cpuUsage = {
      user: currentCpuUsage.user / 1000000, // Convert to seconds
      system: currentCpuUsage.system / 1000000,
      percentage: (
        ((currentCpuUsage.user + currentCpuUsage.system) /
          (process.uptime() * 1000000)) *
        100
      ).toFixed(2)
    }
    this.lastCpuUsage = process.cpuUsage()

    // Load average (Unix systems only)
    if (os.loadavg) {
      this.metrics.system.loadAverage = os.loadavg()
    }
  }

  /**
   * Clean route path for consistent tracking
   */
  getCleanRoute(path) {
    if (!path) return 'unknown'

    // Replace common parameter patterns
    return path
      .replace(/\/:\w+/g, '/:param')
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*$/, '') // Remove query parameters
  }

  /**
   * Get all performance metrics
   */
  getMetrics() {
    this.updateSystemMetrics()

    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch()
    }
  }

  /**
   * Get health status based on metrics
   */
  getHealthStatus() {
    const metrics = this.getMetrics()
    const health = {
      status: 'healthy',
      checks: {},
      timestamp: new Date().toISOString()
    }

    // Memory check (warn if > 80%, critical if > 95%)
    const memoryUsage = parseFloat(metrics.system.memoryUsage.percentage)
    if (memoryUsage > 95) {
      health.status = 'critical'
      health.checks.memory = {
        status: 'critical',
        value: `${memoryUsage}%`,
        threshold: '95%'
      }
    } else if (memoryUsage > 80) {
      health.status = 'warning'
      health.checks.memory = {
        status: 'warning',
        value: `${memoryUsage}%`,
        threshold: '80%'
      }
    } else {
      health.checks.memory = { status: 'healthy', value: `${memoryUsage}%` }
    }

    // Response time check (warn if > 500ms, critical if > 1000ms)
    const avgResponseTime = metrics.requests.avgResponseTime
    if (avgResponseTime > 1000) {
      health.status = 'critical'
      health.checks.responseTime = {
        status: 'critical',
        value: `${avgResponseTime.toFixed(2)}ms`,
        threshold: '1000ms'
      }
    } else if (avgResponseTime > 500) {
      if (health.status !== 'critical') health.status = 'warning'
      health.checks.responseTime = {
        status: 'warning',
        value: `${avgResponseTime.toFixed(2)}ms`,
        threshold: '500ms'
      }
    } else {
      health.checks.responseTime = {
        status: 'healthy',
        value: `${avgResponseTime.toFixed(2)}ms`
      }
    }

    // Error rate check (warn if > 5%, critical if > 10%)
    const errorRate =
      metrics.requests.total > 0
        ? (metrics.errors.count / metrics.requests.total) * 100
        : 0
    if (errorRate > 10) {
      health.status = 'critical'
      health.checks.errorRate = {
        status: 'critical',
        value: `${errorRate.toFixed(2)}%`,
        threshold: '10%'
      }
    } else if (errorRate > 5) {
      if (health.status !== 'critical') health.status = 'warning'
      health.checks.errorRate = {
        status: 'warning',
        value: `${errorRate.toFixed(2)}%`,
        threshold: '5%'
      }
    } else {
      health.checks.errorRate = {
        status: 'healthy',
        value: `${errorRate.toFixed(2)}%`
      }
    }

    return health
  }

  /**
   * Reset metrics (useful for testing or periodic resets)
   */
  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byRoute: {},
        byStatusCode: {},
        avgResponseTime: 0,
        totalResponseTime: 0
      },
      system: {
        uptime: 0,
        memoryUsage: {},
        cpuUsage: {},
        loadAverage: []
      },
      database: {
        queries: 0,
        queryTime: 0,
        avgQueryTime: 0
      },
      errors: {
        count: 0,
        byType: {},
        byRoute: {}
      }
    }
    this.startTime = Date.now()
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor()

// Export middleware functions and monitor instance
export const performanceMiddleware = performanceMonitor.middleware()
export const errorTrackingMiddleware = performanceMonitor.errorMiddleware()
export { performanceMonitor }

// Export convenience function for database query tracking
export const trackDatabaseQuery = (queryTime) => {
  performanceMonitor.trackDatabaseQuery(queryTime)
}
