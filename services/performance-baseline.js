/**
 * Performance Baseline Testing System
 * Establishes performance baselines and monitors deviations
 */

import { performance } from 'perf_hooks'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class PerformanceBaseline {
  constructor() {
    this.baselines = new Map()
    this.measurements = []
    this.thresholds = {
      responseTime: 1000, // 1 second
      memoryUsage: 100 * 1024 * 1024, // 100MB
      cpuUsage: 80, // 80%
      errorRate: 0.05 // 5%
    }
    this.reportPath = path.join(
      __dirname,
      '../reports/performance-baseline.json'
    )
    this.loadBaselines()
  }

  /**
   * Load existing baselines from file
   */
  loadBaselines() {
    try {
      const reportDir = path.dirname(this.reportPath)
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true })
      }

      if (fs.existsSync(this.reportPath)) {
        const data = fs.readFileSync(this.reportPath, 'utf8')
        const saved = JSON.parse(data)

        if (saved.baselines) {
          this.baselines = new Map(Object.entries(saved.baselines))
        }

        if (saved.thresholds) {
          this.thresholds = { ...this.thresholds, ...saved.thresholds }
        }

        console.log('📊 Performance baselines loaded')
      }
    } catch (error) {
      console.warn('⚠️  Could not load performance baselines:', error.message)
    }
  }

  /**
   * Save baselines to file
   */
  saveBaselines() {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        baselines: Object.fromEntries(this.baselines),
        thresholds: this.thresholds,
        measurements: this.measurements.slice(-100) // Keep last 100 measurements
      }

      fs.writeFileSync(this.reportPath, JSON.stringify(data, null, 2))
      console.log('💾 Performance baselines saved')
    } catch (error) {
      console.error('❌ Error saving baselines:', error)
    }
  }

  /**
   * Record a performance measurement
   */
  recordMeasurement(endpoint, duration, metadata = {}) {
    const measurement = {
      endpoint,
      duration,
      timestamp: new Date().toISOString(),
      metadata: {
        method: metadata.method || 'GET',
        statusCode: metadata.statusCode || 200,
        userAgent: metadata.userAgent || 'unknown',
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage(),
        ...metadata
      }
    }

    this.measurements.push(measurement)

    // Keep only recent measurements in memory
    if (this.measurements.length > 1000) {
      this.measurements = this.measurements.slice(-500)
    }

    // Update baseline if this is a new endpoint or significantly different
    this.updateBaseline(endpoint, duration, metadata)

    return measurement
  }

  /**
   * Update baseline for an endpoint
   */
  updateBaseline(endpoint, duration, metadata) {
    const key = `${metadata.method || 'GET'}_${endpoint}`
    const existing = this.baselines.get(key)

    if (!existing) {
      // First measurement for this endpoint
      this.baselines.set(key, {
        endpoint,
        method: metadata.method || 'GET',
        avgDuration: duration,
        minDuration: duration,
        maxDuration: duration,
        measurementCount: 1,
        lastUpdated: new Date().toISOString(),
        p95: duration,
        p99: duration
      })
    } else {
      // Update existing baseline
      const count = existing.measurementCount + 1
      const newAvg =
        (existing.avgDuration * existing.measurementCount + duration) / count

      existing.avgDuration = newAvg
      existing.minDuration = Math.min(existing.minDuration, duration)
      existing.maxDuration = Math.max(existing.maxDuration, duration)
      existing.measurementCount = count
      existing.lastUpdated = new Date().toISOString()

      // Calculate percentiles from recent measurements
      const recentMeasurements = this.measurements
        .filter(
          (m) =>
            m.endpoint === endpoint &&
            m.metadata.method === (metadata.method || 'GET')
        )
        .slice(-100)
        .map((m) => m.duration)
        .sort((a, b) => a - b)

      if (recentMeasurements.length >= 10) {
        const p95Index = Math.floor(recentMeasurements.length * 0.95)
        const p99Index = Math.floor(recentMeasurements.length * 0.99)
        existing.p95 = recentMeasurements[p95Index]
        existing.p99 = recentMeasurements[p99Index]
      }

      this.baselines.set(key, existing)
    }
  }

  /**
   * Check if measurement exceeds baseline
   */
  checkPerformanceDeviation(endpoint, duration, metadata = {}) {
    const key = `${metadata.method || 'GET'}_${endpoint}`
    const baseline = this.baselines.get(key)

    if (!baseline) {
      return {
        hasDeviation: false,
        reason: 'No baseline established',
        baseline: null,
        actual: duration
      }
    }

    const deviationThreshold = baseline.avgDuration * 2 // 200% of average
    const absoluteThreshold = this.thresholds.responseTime

    const hasDeviation =
      duration > deviationThreshold || duration > absoluteThreshold

    return {
      hasDeviation,
      reason: hasDeviation
        ? duration > absoluteThreshold
          ? 'Absolute threshold exceeded'
          : 'Baseline deviation'
        : 'Within baseline',
      baseline: baseline.avgDuration,
      actual: duration,
      deviation: (
        ((duration - baseline.avgDuration) / baseline.avgDuration) *
        100
      ).toFixed(2),
      p95: baseline.p95,
      p99: baseline.p99
    }
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMeasurements: this.measurements.length,
        uniqueEndpoints: this.baselines.size,
        thresholds: this.thresholds
      },
      baselines: Array.from(this.baselines.values()),
      recentPerformance: this.getRecentPerformanceStats(),
      alerts: this.getPerformanceAlerts(),
      recommendations: this.getPerformanceRecommendations()
    }

    return report
  }

  /**
   * Get recent performance statistics
   */
  getRecentPerformanceStats() {
    const recent = this.measurements.slice(-100)

    if (recent.length === 0) {
      return { message: 'No recent measurements available' }
    }

    const durations = recent.map((m) => m.duration)
    const avgDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length
    const minDuration = Math.min(...durations)
    const maxDuration = Math.max(...durations)

    // Calculate percentiles
    const sortedDurations = durations.sort((a, b) => a - b)
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)]
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)]
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)]

    // Error rate
    const errors = recent.filter((m) => m.metadata.statusCode >= 400).length
    const errorRate = errors / recent.length

    // Memory usage
    const memoryUsages = recent
      .map((m) => m.metadata.memoryUsage)
      .filter((m) => m)
    const avgMemory =
      memoryUsages.length > 0
        ? memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length
        : 0

    return {
      period: 'Last 100 requests',
      requestCount: recent.length,
      avgDuration: Math.round(avgDuration),
      minDuration: Math.round(minDuration),
      maxDuration: Math.round(maxDuration),
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
      errorRate: (errorRate * 100).toFixed(2),
      avgMemoryUsage: Math.round(avgMemory / 1024 / 1024) // MB
    }
  }

  /**
   * Get performance alerts
   */
  getPerformanceAlerts() {
    const alerts = []
    const recent = this.measurements.slice(-50)

    // Check for recent slow responses
    const slowResponses = recent.filter(
      (m) => m.duration > this.thresholds.responseTime
    )
    if (slowResponses.length > 5) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `${slowResponses.length} slow responses detected in recent requests`,
        count: slowResponses.length
      })
    }

    // Check error rate
    const errors = recent.filter((m) => m.metadata.statusCode >= 400)
    const errorRate = errors.length / recent.length
    if (errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'errors',
        severity: 'critical',
        message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
        errorRate: (errorRate * 100).toFixed(2)
      })
    }

    // Check memory usage trends
    const memoryMeasurements = recent
      .map((m) => m.metadata.memoryUsage)
      .filter((m) => m)

    if (memoryMeasurements.length > 10) {
      const avgMemory =
        memoryMeasurements.reduce((sum, m) => sum + m, 0) /
        memoryMeasurements.length
      if (avgMemory > this.thresholds.memoryUsage) {
        alerts.push({
          type: 'memory',
          severity: 'warning',
          message: `High memory usage detected: ${Math.round(
            avgMemory / 1024 / 1024
          )}MB`,
          averageMemory: Math.round(avgMemory / 1024 / 1024)
        })
      }
    }

    return alerts
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations() {
    const recommendations = []
    const recent = this.measurements.slice(-100)

    // Analyze endpoint performance
    const endpointStats = new Map()
    recent.forEach((m) => {
      const key = `${m.metadata.method || 'GET'}_${m.endpoint}`
      if (!endpointStats.has(key)) {
        endpointStats.set(key, { durations: [], errors: 0, count: 0 })
      }
      const stats = endpointStats.get(key)
      stats.durations.push(m.duration)
      stats.count++
      if (m.metadata.statusCode >= 400) {
        stats.errors++
      }
    })

    // Find slow endpoints
    endpointStats.forEach((stats, endpoint) => {
      const avgDuration =
        stats.durations.reduce((sum, d) => sum + d, 0) / stats.durations.length

      if (avgDuration > this.thresholds.responseTime && stats.count >= 5) {
        recommendations.push({
          type: 'performance',
          endpoint,
          issue: `Slow average response time: ${Math.round(avgDuration)}ms`,
          recommendation:
            'Consider implementing caching, database query optimization, or pagination',
          priority: 'high'
        })
      }

      // Check error rates per endpoint
      const errorRate = stats.errors / stats.count
      if (errorRate > 0.1 && stats.count >= 10) {
        recommendations.push({
          type: 'reliability',
          endpoint,
          issue: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
          recommendation:
            'Review error handling and input validation for this endpoint',
          priority: 'critical'
        })
      }
    })

    // General recommendations based on patterns
    if (recent.length >= 50) {
      const memoryGrowth = this.checkMemoryGrowthTrend(recent)
      if (memoryGrowth > 1.5) {
        recommendations.push({
          type: 'memory',
          issue: 'Memory usage appears to be growing over time',
          recommendation: 'Check for memory leaks and implement proper cleanup',
          priority: 'medium'
        })
      }
    }

    return recommendations
  }

  /**
   * Check memory growth trend
   */
  checkMemoryGrowthTrend(measurements) {
    const memoryData = measurements
      .map((m) => m.metadata.memoryUsage)
      .filter((m) => m)

    if (memoryData.length < 10) return 0

    const firstHalf = memoryData.slice(0, Math.floor(memoryData.length / 2))
    const secondHalf = memoryData.slice(Math.floor(memoryData.length / 2))

    const firstAvg = firstHalf.reduce((sum, m) => sum + m, 0) / firstHalf.length
    const secondAvg =
      secondHalf.reduce((sum, m) => sum + m, 0) / secondHalf.length

    return secondAvg / firstAvg
  }

  /**
   * Reset baselines (useful for major application changes)
   */
  resetBaselines() {
    this.baselines.clear()
    this.measurements = []
    this.saveBaselines()
    console.log('🔄 Performance baselines reset')
  }

  /**
   * Set custom thresholds
   */
  setThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds }
    this.saveBaselines()
    console.log('⚙️  Performance thresholds updated')
  }

  /**
   * Get baseline for specific endpoint
   */
  getBaseline(endpoint, method = 'GET') {
    const key = `${method}_${endpoint}`
    return this.baselines.get(key)
  }

  /**
   * Export performance data
   */
  exportData() {
    return {
      baselines: Object.fromEntries(this.baselines),
      measurements: this.measurements,
      thresholds: this.thresholds,
      report: this.generateReport()
    }
  }
}

export { PerformanceBaseline }
