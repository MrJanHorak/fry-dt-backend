/**
 * UX Testing API Routes
 * Provides endpoints for running UX tests and accessing results
 */

import { Router } from 'express'
import { UXTestingSuite } from '../services/ux-testing.js'
import { checkAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()
const uxTester = new UXTestingSuite()

/**
 * GET /api/ux/health
 * Get UX testing service health
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    res.json({
      status: 'ok',
      service: 'UX Testing Suite',
      timestamp: new Date().toISOString(),
      capabilities: [
        'Core Web Vitals',
        'Accessibility Testing',
        'Responsive Design',
        'User Flow Testing',
        'Performance Testing',
        'Content Quality',
        'Navigation Testing'
      ]
    })
  })
)

/**
 * POST /api/ux/test/full
 * Run complete UX test suite
 * Requires authentication
 */
router.post(
  '/test/full',
  checkAuth,
  asyncHandler(async (req, res) => {
    console.log('🧪 Starting full UX test suite...')

    try {
      const results = await uxTester.runFullTestSuite()
      const recommendations = uxTester.generateRecommendations(
        results.testResults
      )

      res.json({
        success: true,
        message: 'UX test suite completed successfully',
        data: {
          ...results,
          recommendations
        }
      })
    } catch (error) {
      console.error('UX test suite failed:', error)
      res.status(500).json({
        success: false,
        message: 'UX test suite failed',
        error: error.message
      })
    }
  })
)

/**
 * POST /api/ux/test/core-web-vitals
 * Run Core Web Vitals tests only
 */
router.post(
  '/test/core-web-vitals',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      const results = await uxTester.testCoreWebVitals()

      res.json({
        success: true,
        message: 'Core Web Vitals tests completed',
        data: results
      })
    } catch (error) {
      console.error('Core Web Vitals test failed:', error)
      res.status(500).json({
        success: false,
        message: 'Core Web Vitals test failed',
        error: error.message
      })
    }
  })
)

/**
 * POST /api/ux/test/accessibility
 * Run accessibility tests only
 */
router.post(
  '/test/accessibility',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      const results = await uxTester.testAccessibility()

      res.json({
        success: true,
        message: 'Accessibility tests completed',
        data: results
      })
    } catch (error) {
      console.error('Accessibility test failed:', error)
      res.status(500).json({
        success: false,
        message: 'Accessibility test failed',
        error: error.message
      })
    }
  })
)

/**
 * POST /api/ux/test/responsive
 * Run responsive design tests only
 */
router.post(
  '/test/responsive',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      const results = await uxTester.testResponsiveDesign()

      res.json({
        success: true,
        message: 'Responsive design tests completed',
        data: results
      })
    } catch (error) {
      console.error('Responsive design test failed:', error)
      res.status(500).json({
        success: false,
        message: 'Responsive design test failed',
        error: error.message
      })
    }
  })
)

/**
 * POST /api/ux/test/user-flows
 * Run user flow tests only
 */
router.post(
  '/test/user-flows',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      const results = await uxTester.testUserFlows()

      res.json({
        success: true,
        message: 'User flow tests completed',
        data: results
      })
    } catch (error) {
      console.error('User flow test failed:', error)
      res.status(500).json({
        success: false,
        message: 'User flow test failed',
        error: error.message
      })
    }
  })
)

/**
 * POST /api/ux/test/performance
 * Run performance tests only
 */
router.post(
  '/test/performance',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      const results = await uxTester.testPerformance()

      res.json({
        success: true,
        message: 'Performance tests completed',
        data: results
      })
    } catch (error) {
      console.error('Performance test failed:', error)
      res.status(500).json({
        success: false,
        message: 'Performance test failed',
        error: error.message
      })
    }
  })
)

/**
 * POST /api/ux/test/content
 * Run content quality tests only
 */
router.post(
  '/test/content',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      const results = await uxTester.testContentQuality()

      res.json({
        success: true,
        message: 'Content quality tests completed',
        data: results
      })
    } catch (error) {
      console.error('Content quality test failed:', error)
      res.status(500).json({
        success: false,
        message: 'Content quality test failed',
        error: error.message
      })
    }
  })
)

/**
 * POST /api/ux/test/navigation
 * Run navigation tests only
 */
router.post(
  '/test/navigation',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      const results = await uxTester.testNavigation()

      res.json({
        success: true,
        message: 'Navigation tests completed',
        data: results
      })
    } catch (error) {
      console.error('Navigation test failed:', error)
      res.status(500).json({
        success: false,
        message: 'Navigation test failed',
        error: error.message
      })
    }
  })
)

/**
 * GET /api/ux/recommendations
 * Get UX recommendations based on last test results
 */
router.get(
  '/recommendations',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      // Run a quick test suite to get current recommendations
      const results = await uxTester.runFullTestSuite()
      const recommendations = uxTester.generateRecommendations(
        results.testResults
      )

      res.json({
        success: true,
        data: recommendations,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to generate recommendations',
        error: error.message
      })
    }
  })
)

/**
 * GET /api/ux/export
 * Export UX test results
 */
router.get(
  '/export',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      const { format = 'json' } = req.query

      const exportData = await uxTester.exportResults(format)

      const filename = `ux-test-results-${
        new Date().toISOString().split('T')[0]
      }.${format}`

      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

      res.send(exportData)
    } catch (error) {
      console.error('Failed to export UX results:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to export UX results',
        error: error.message
      })
    }
  })
)

/**
 * GET /api/ux/config
 * Get UX testing configuration
 */
router.get(
  '/config',
  checkAuth,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: uxTester.testConfiguration,
      timestamp: new Date().toISOString()
    })
  })
)

/**
 * PUT /api/ux/config
 * Update UX testing configuration
 * Requires admin privileges
 */
router.put(
  '/config',
  checkAuth,
  asyncHandler(async (req, res) => {
    // Check if user has admin privileges
    if (!req.user?.profile?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required to update UX testing configuration'
      })
    }

    try {
      const { configuration } = req.body

      if (!configuration || typeof configuration !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Valid configuration object required'
        })
      }

      // Update configuration
      uxTester.testConfiguration = {
        ...uxTester.testConfiguration,
        ...configuration
      }

      res.json({
        success: true,
        message: 'UX testing configuration updated successfully',
        data: uxTester.testConfiguration
      })
    } catch (error) {
      console.error('Failed to update UX configuration:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to update UX configuration',
        error: error.message
      })
    }
  })
)

/**
 * POST /api/ux/feedback
 * Submit user feedback for UX improvements
 */
router.post(
  '/feedback',
  checkAuth,
  asyncHandler(async (req, res) => {
    try {
      const { feedback, category, priority = 'medium', page } = req.body

      if (!feedback || !category) {
        return res.status(400).json({
          success: false,
          message: 'Feedback content and category are required'
        })
      }

      const feedbackEntry = {
        id: Date.now().toString(),
        feedback,
        category,
        priority,
        page,
        userId: req.user.id,
        userRole: req.user.profile?.role || 'unknown',
        timestamp: new Date().toISOString(),
        status: 'new'
      }

      // Store feedback (in real implementation, save to database)
      uxTester.userFeedback.push(feedbackEntry)

      res.status(201).json({
        success: true,
        message: 'User feedback submitted successfully',
        data: feedbackEntry
      })
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to submit feedback',
        error: error.message
      })
    }
  })
)

/**
 * GET /api/ux/feedback
 * Get user feedback submissions
 * Requires admin privileges
 */
router.get(
  '/feedback',
  checkAuth,
  asyncHandler(async (req, res) => {
    // Check if user has admin privileges
    if (!req.user?.profile?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required to view feedback'
      })
    }

    try {
      const { status, category, priority } = req.query

      let feedback = [...uxTester.userFeedback]

      // Apply filters
      if (status) {
        feedback = feedback.filter((f) => f.status === status)
      }

      if (category) {
        feedback = feedback.filter((f) => f.category === category)
      }

      if (priority) {
        feedback = feedback.filter((f) => f.priority === priority)
      }

      // Sort by timestamp (newest first)
      feedback.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      res.json({
        success: true,
        data: feedback,
        total: feedback.length,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to retrieve feedback:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve feedback',
        error: error.message
      })
    }
  })
)

export { router }
