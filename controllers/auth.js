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
function signup(req, res) {
  Profile.findOne({ email: req.body.email })
    .then((profile) => {
      if (profile) {
        throw new Error('Account already exists')
      } else if (!process.env.SECRET) {
        throw new Error('no SECRET in .env file')
      } else {
        Profile.create(req.body).then((newProfile) => {
          req.body.profile = newProfile._id
          User.create(req.body)
            .then((user) => {
              const token = createJWT(user)
              res.status(200).json({ token })
            })
            .catch((err) => {
              Profile.findByIdAndDelete(req.body.profile)
              res.status(500).json({ err: err.errmsg })
            })
        })
      }
    })
    .catch((err) => {
      res.status(500).json({ err: err.message })
    })
}

/**
 * Adds a student to the system.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
function addStudent(req, res) {
  Profile.findOne({ name: req.body.name })
    .then((profile) => {
      if (profile) {
        throw new Error('Account already exists')
      } else if (!process.env.SECRET) {
        throw new Error('no SECRET in .env file')
      } else {
        User.findOne({ email: req.body.email })
          .then((user) => {
            req.body.password = user.password
            req.body.email = user.email
          })
          .then(
            Profile.create(req.body).then((newProfile) => {
              req.body.profile = newProfile._id
              User.create(req.body)
                .then((newUser) => {
                  const token = createJWT(newUser)
                  res.status(200).json({ token })
                })
                .then(
                  Profile.findOne({ email: req.body.email }).then(
                    (parentProfile) => {
                      parentProfile.students.push(newProfile._id),
                        parentProfile.save()
                    }
                  )
                )
                .catch((err) => {
                  Profile.findByIdAndDelete(req.body.profile)
                  res.status(500).json({ err: err.message })
                })
            })
          )
      }
    })
    .catch((err) => {
      res.status(500).json({ err: err.message })
    })
}

function login(req, res) {
  User.findOne({ name: req.body.name })
    .then((user) => {
      if (!user) return res.status(401).json({ err: 'User not found' })
      user.comparePassword(req.body.pw, (err, isMatch) => {
        if (isMatch) {
          const token = createJWT(user)
          res.json({ token })
        } else {
          res.status(401).json({ err: 'Incorrect password' })
        }
      })
    })
    .catch((err) => {
      res.status(500).json(err)
    })
}

function changePassword(req, res) {
  let userId
  try {
    userId = mongoose.Types.ObjectId(req.body.student)
  } catch (err) {
    console.log('Invalid student ID:', err)
    return res.status(400).json({ err: 'Invalid student ID' })
  }
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ err: 'Unauthorized' })
  }
  User.findOne({ profile: userId })
    .then((user) => {
      if (!user) return res.status(401).json({ err: 'User not found' })
      user.password = req.body.newPw
      user.isPasswordUpdate = true
      user
        .save()
        .then(() => {
          res.status(200).json({ msg: 'Password updated' })
        })
        .catch((err) => {
          console.log('Error saving user:', err)
          res.status(500).json({ err: 'Error updating password' })
        })
    })
    .catch((err) => {
      console.log('Error finding user:', err)
      res.status(500).json({ err: 'Error finding user' })
    })
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
