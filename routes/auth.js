import { Router } from 'express'
import * as authCtrl from '../controllers/auth.js'
import { decodeUserFromToken, checkAuth } from '../middleware/auth.js'
import {
  validateSignup,
  validateLogin,
  validateAddStudent
} from '../middleware/validation.js'
import { asyncHandler } from '../middleware/errorHandler.js'

const router = Router()

/*--------- Public Routes ---------*/
router.post('/signup', validateSignup, asyncHandler(authCtrl.signup))
router.post('/login', validateLogin, asyncHandler(authCtrl.login))

/*------- Protected Routes -------*/
router.use(decodeUserFromToken)
router.post('/changePassword', checkAuth, asyncHandler(authCtrl.changePassword))
router.post(
  '/addStudent',
  checkAuth,
  validateAddStudent,
  asyncHandler(authCtrl.addStudent)
)

export { router }
