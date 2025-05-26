import { Router } from 'express'
import * as profilesCtrl from '../controllers/profiles.js'
import { decodeUserFromToken, checkAuth } from '../middleware/auth.js'
import {
  validateObjectId,
  validatePracticedWord
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

export { router }
