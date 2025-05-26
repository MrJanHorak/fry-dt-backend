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

const router = Router()

/*------- Protected Routes -------*/

router.use(decodeUserFromToken)
router.get('/', checkAuth, asyncHandler(profilesCtrl.index))
router.get(
  '/:id',
  checkAuth,
  validateObjectId('id'),
  asyncHandler(profilesCtrl.show)
)
router.put(
  '/:id',
  checkAuth,
  validateObjectId('id'),
  asyncHandler(profilesCtrl.update)
)
router.post(
  '/:id/practicedWords',
  checkAuth,
  validateObjectId('id'),
  validatePracticedWord,
  asyncHandler(profilesCtrl.addPracticedWord)
)
router.put(
  '/:id/practicedWords/:practicedWordId',
  checkAuth,
  validateObjectId('id'),
  validateObjectId('practicedWordId'),
  validatePracticedWord,
  asyncHandler(profilesCtrl.updatePracticedWord)
)
router.put(
  '/:id/removeStudent/:studentId',
  checkAuth,
  validateObjectId('id'),
  validateObjectId('studentId'),
  asyncHandler(profilesCtrl.removeStudentFromProfile)
)

// Assessment routes
router.post(
  '/:id/assessments',
  checkAuth,
  validateObjectId('id'),
  validateAssessment,
  asyncHandler(profilesCtrl.addAssessment)
)
router.put(
  '/:id/assessments/:assessmentId',
  checkAuth,
  validateObjectId('id'),
  validateObjectId('assessmentId'),
  validateAssessment,
  asyncHandler(profilesCtrl.updateAssessment)
)
router.get(
  '/:id/assessments',
  checkAuth,
  validateObjectId('id'),
  asyncHandler(profilesCtrl.getAssessments)
)

// Test session routes
router.post(
  '/:id/testSessions',
  checkAuth,
  validateObjectId('id'),
  validateTestSession,
  asyncHandler(profilesCtrl.addTestSession)
)
router.put(
  '/:id/testSessions/:sessionId',
  checkAuth,
  validateObjectId('id'),
  validateObjectId('sessionId'),
  validateTestSession,
  asyncHandler(profilesCtrl.updateTestSession)
)
router.get(
  '/:id/testSessions',
  checkAuth,
  validateObjectId('id'),
  asyncHandler(profilesCtrl.getTestSessions)
)

// Progress and analytics routes
router.get(
  '/:id/progress',
  checkAuth,
  validateObjectId('id'),
  asyncHandler(profilesCtrl.getStudentProgress)
)

// Speech recognition monitoring routes
router.get(
  '/:id/speech-sessions',
  checkAuth,
  validateObjectId('id'),
  asyncHandler(profilesCtrl.getActiveSpeechSessions)
)

export { router }
