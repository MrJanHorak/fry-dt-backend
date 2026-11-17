import { Router } from 'express'
import * as progressCtrl from '../controllers/progress.js'
import * as assignmentsCtrl from '../controllers/assignments.js'
import { decodeUserFromToken, checkAuth } from '../middleware/auth.js'
import { requireProfileAccess, requireRole } from '../middleware/authorize.js'
import { validateObjectId } from '../middleware/validation.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { FRY_LISTS } from '../data/fryWords.js'

/* ---------------- /api/words (public reference data) ---------------- */
export const wordsRouter = Router()
wordsRouter.get('/fry', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400')
  res.json(FRY_LISTS)
})

/* ---------------- /api/progress ---------------- */
export const progressRouter = Router()
progressRouter.use(decodeUserFromToken, checkAuth)

progressRouter.get(
  '/insights',
  requireRole('teacher', 'parent'),
  asyncHandler(progressCtrl.getInsights)
)
progressRouter.get(
  '/class/export.csv',
  requireRole('teacher', 'parent'),
  asyncHandler(progressCtrl.exportClassCsv)
)
progressRouter.get(
  '/:studentId/export.csv',
  validateObjectId('studentId'),
  requireProfileAccess('studentId'),
  asyncHandler(progressCtrl.exportStudentCsv)
)
progressRouter.get(
  '/class',
  requireRole('teacher', 'parent'),
  asyncHandler(progressCtrl.getClassProgress)
)
progressRouter.post(
  '/:studentId/attempts',
  validateObjectId('studentId'),
  requireProfileAccess('studentId'),
  asyncHandler(progressCtrl.recordAttempts)
)
progressRouter.get(
  '/:studentId/summary',
  validateObjectId('studentId'),
  requireProfileAccess('studentId'),
  asyncHandler(progressCtrl.getSummary)
)
progressRouter.get(
  '/:studentId/practice',
  validateObjectId('studentId'),
  requireProfileAccess('studentId'),
  asyncHandler(progressCtrl.getPracticeSession)
)

/* ---------------- /api/assignments ---------------- */
export const assignmentsRouter = Router()
assignmentsRouter.use(decodeUserFromToken, checkAuth)

assignmentsRouter.get('/', asyncHandler(assignmentsCtrl.index))
assignmentsRouter.post(
  '/',
  requireRole('teacher', 'parent'),
  asyncHandler(assignmentsCtrl.create)
)
assignmentsRouter.put(
  '/:id',
  validateObjectId('id'),
  requireRole('teacher', 'parent'),
  asyncHandler(assignmentsCtrl.update)
)
assignmentsRouter.delete(
  '/:id',
  validateObjectId('id'),
  requireRole('teacher', 'parent'),
  asyncHandler(assignmentsCtrl.archive)
)
assignmentsRouter.get(
  '/:id/progress',
  validateObjectId('id'),
  requireRole('teacher', 'parent'),
  asyncHandler(assignmentsCtrl.progress)
)
