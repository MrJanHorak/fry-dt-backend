import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as authCtrl from '../controllers/auth.js'
import { decodeUserFromToken, checkAuth } from '../middleware/auth.js'
import { requireEducatorOf } from '../middleware/authorize.js'
import {
  validateSignup,
  validateLogin,
  validateAddStudent,
  validateObjectId
} from '../middleware/validation.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

// Slow down password guessing. A classroom shares one IP address, so the
// limit is generous enough for ~30 kids signing in at the same time.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT) || 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { err: 'Too many sign-in attempts. Please wait a few minutes.' },
  skip: () => process.env.NODE_ENV === 'test'
})

/*--------- Public Routes ---------*/
router.post(
  '/signup',
  loginLimiter,
  validateSignup,
  asyncHandler(authCtrl.signup)
)
router.post('/login', loginLimiter, validateLogin, asyncHandler(authCtrl.login))
router.post('/qr-login', loginLimiter, asyncHandler(authCtrl.qrLogin))

/*------- Protected Routes -------*/
router.use(decodeUserFromToken)

router.post('/changePassword', checkAuth, asyncHandler(authCtrl.changePassword))
router.post(
  '/addStudent',
  checkAuth,
  validateAddStudent,
  asyncHandler(authCtrl.addStudent)
)
router.post(
  '/students/:studentId/login-card',
  checkAuth,
  validateObjectId('studentId'),
  requireEducatorOf('studentId'),
  asyncHandler(authCtrl.issueLoginCard)
)

export { router }
