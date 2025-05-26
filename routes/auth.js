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

// Debug endpoint to test token authentication
router.get('/debug-token', checkAuth, (req, res) => {
  res.json({
    message: 'Token is valid',
    user: req.user,
    timestamp: new Date().toISOString()
  })
})

router.post('/changePassword', checkAuth, asyncHandler(authCtrl.changePassword))
router.post(
  '/addStudent',
  checkAuth,
  validateAddStudent,
  asyncHandler(authCtrl.addStudent)
)

export { router }
