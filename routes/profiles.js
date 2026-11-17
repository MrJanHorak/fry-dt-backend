import { Router } from 'express'
import * as profilesCtrl from '../controllers/profiles.js'
import { decodeUserFromToken, checkAuth } from '../middleware/auth.js'
import {
  validateObjectId,
  validatePracticedWord,
  validateAssessment,
  validateTestSession
} from '../middleware/validation.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireProfileAccess, requireAdmin } from '../middleware/authorize.js'

const router = Router()

/*------- Protected Routes -------*/

router.use(decodeUserFromToken)
// Listing every profile is an admin-only operation
router.get('/', checkAuth, requireAdmin, asyncHandler(profilesCtrl.index))
router.get(
  '/:id',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  asyncHandler(profilesCtrl.show)
)
router.put(
  '/:id',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  asyncHandler(profilesCtrl.update)
)
router.post(
  '/:id/practicedWords',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  validatePracticedWord,
  asyncHandler(profilesCtrl.addPracticedWord)
)
router.put(
  '/:id/practicedWords/:practicedWordId',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  validateObjectId('practicedWordId'),
  validatePracticedWord,
  asyncHandler(profilesCtrl.updatePracticedWord)
)
router.put(
  '/:id/removeStudent/:studentId',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  validateObjectId('studentId'),
  asyncHandler(profilesCtrl.removeStudentFromProfile)
)

// Assessment routes
router.post(
  '/:id/assessments',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  validateAssessment,
  asyncHandler(profilesCtrl.addAssessment)
)
router.put(
  '/:id/assessments/:assessmentId',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  validateObjectId('assessmentId'),
  validateAssessment,
  asyncHandler(profilesCtrl.updateAssessment)
)
router.get(
  '/:id/assessments',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  asyncHandler(profilesCtrl.getAssessments)
)

// Test session routes
router.post(
  '/:id/testSessions',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  validateTestSession,
  asyncHandler(profilesCtrl.addTestSession)
)
router.put(
  '/:id/testSessions/:sessionId',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  validateTestSession,
  asyncHandler(profilesCtrl.updateTestSession)
)
router.get(
  '/:id/testSessions',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  asyncHandler(profilesCtrl.getTestSessions)
)

// Progress and analytics routes
router.get(
  '/:id/progress',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  asyncHandler(profilesCtrl.getStudentProgress)
)

// Speech recognition monitoring routes
router.get(
  '/:id/speech-sessions',
  checkAuth,
  validateObjectId('id'),
  requireProfileAccess('id'),
  asyncHandler(profilesCtrl.getActiveSpeechSessions)
)

export { router }
