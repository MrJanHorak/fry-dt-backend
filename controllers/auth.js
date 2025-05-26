import { User } from '../models/user.js'
import { Profile } from '../models/profile.js'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

/**
 * Handles the signup functionality.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
async function signup(req, res) {
  try {
    // Input validation
    if (!req.body.email || !req.body.password || !req.body.name) {
      return res.status(400).json({ err: 'Missing required fields' })
    }

    if (!process.env.SECRET) {
      return res.status(500).json({ err: 'Server configuration error' })
    }

    // Check if profile already exists
    const existingProfile = await Profile.findOne({ email: req.body.email })
    if (existingProfile) {
      return res.status(409).json({ err: 'Account already exists' })
    }

    // Create profile and user atomically
    const newProfile = await Profile.create(req.body)

    try {
      req.body.profile = newProfile._id
      const user = await User.create(req.body)
      const token = createJWT(user)
      res.status(201).json({ token })
    } catch (userErr) {
      // Cleanup profile if user creation fails
      await Profile.findByIdAndDelete(newProfile._id)
      throw userErr
    }
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ err: err.message || 'Internal server error' })
  }
}

/**
 * Adds a student to the system.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
async function addStudent(req, res) {
  try {
    // Input validation
    if (!req.body.name || !req.body.email) {
      return res.status(400).json({ err: 'Missing required fields' })
    }

    if (!process.env.SECRET) {
      return res.status(500).json({ err: 'Server configuration error' })
    }

    // Check if student profile already exists
    const existingProfile = await Profile.findOne({ name: req.body.name })
    if (existingProfile) {
      return res.status(409).json({ err: 'Student account already exists' })
    }

    // Find parent user to get credentials
    const parentUser = await User.findOne({ email: req.body.email })
    if (!parentUser) {
      return res.status(404).json({ err: 'Parent user not found' })
    }

    req.body.password = parentUser.password
    req.body.email = parentUser.email

    // Set default values for required Profile fields
    const studentProfileData = {
      ...req.body,
      role: req.body.role || 'student',
      grade: req.body.grade || 1,
      avatar: req.body.avatar || '😊'
    }

    // Create student profile
    const newStudentProfile = await Profile.create(studentProfileData)

    try {
      // Create student user with required fields
      const studentUserData = {
        ...req.body,
        profile: newStudentProfile._id,
        role: req.body.role || 'student'
      }
      const newUser = await User.create(studentUserData)

      // Add student to parent's profile
      const parentProfile = await Profile.findOne({ email: req.body.email })
      if (parentProfile) {
        parentProfile.students.push(newStudentProfile._id)
        await parentProfile.save()
      }

      const token = createJWT(newUser)
      res.status(201).json({ token })
    } catch (userErr) {
      // Cleanup student profile if user creation fails
      await Profile.findByIdAndDelete(newStudentProfile._id)
      throw userErr
    }
  } catch (err) {
    console.error('Add student error:', err)
    res.status(500).json({ err: err.message || 'Internal server error' })
  }
}

async function login(req, res) {
  try {
    // Input validation
    if (!req.body.name || !req.body.pw) {
      return res.status(400).json({ err: 'Missing username or password' })
    }

    const user = await User.findOne({ name: req.body.name })
    if (!user) {
      return res.status(401).json({ err: 'Invalid credentials' })
    }

    // Use promisified comparePassword
    const isMatch = await new Promise((resolve, reject) => {
      user.comparePassword(req.body.pw, (err, match) => {
        if (err) reject(err)
        else resolve(match)
      })
    })

    if (isMatch) {
      const token = createJWT(user)
      res.json({ token })
    } else {
      res.status(401).json({ err: 'Invalid credentials' })
    }
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ err: 'Internal server error' })
  }
}

async function changePassword(req, res) {
  try {
    // Input validation
    if (!req.body.student || !req.body.newPw) {
      return res.status(400).json({ err: 'Missing required fields' })
    }

    if (req.user.role !== 'teacher') {
      return res.status(403).json({ err: 'Unauthorized' })
    }

    let userId
    try {
      userId = mongoose.Types.ObjectId(req.body.student)
    } catch (err) {
      console.error('Invalid student ID:', err)
      return res.status(400).json({ err: 'Invalid student ID' })
    }

    const user = await User.findOne({ profile: userId })
    if (!user) {
      return res.status(404).json({ err: 'User not found' })
    }

    user.password = req.body.newPw
    user.isPasswordUpdate = true
    await user.save()

    res.status(200).json({ msg: 'Password updated successfully' })
  } catch (err) {
    console.error('Change password error:', err)
    res.status(500).json({ err: 'Error updating password' })
  }
}

/* --== Helper Functions ==-- */

/**
 * Creates a JSON Web Token (JWT) for the given user.
 * @param {Object} user - The user object.
 * @returns {string} - The generated JWT.
 */
function createJWT(user) {
  return jwt.sign({ user }, process.env.SECRET, { expiresIn: '24h' })
}

export { signup, login, changePassword, addStudent }
