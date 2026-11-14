import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import crypto from 'crypto'

const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12

/**
 * User Schema (login credentials).
 * The matching Profile document holds everything about the learner/teacher.
 */
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, required: true, lowercase: true },
    password: String,
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
    role: {
      type: String,
      required: true
    },
    isPasswordUpdate: {
      type: Boolean,
      default: false
    },
    // SHA-256 of the student's personal QR login code (never stored in clear)
    loginCodeHash: { type: String, select: false },
    loginCodeIssuedAt: { type: Date }
  },
  {
    timestamps: true
  }
)

userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password
    delete ret.loginCodeHash
    return ret
  }
})

userSchema.pre('save', function (next) {
  const user = this

  // Only hash password if it has been modified
  if (!user.isModified('password')) {
    return next()
  }

  bcrypt
    .hash(user.password, SALT_ROUNDS)
    .then((hash) => {
      user.password = hash
      next()
    })
    .catch((err) => {
      console.log(err)
      next(err)
    })
})

userSchema.methods.comparePassword = function (tryPassword, cb) {
  bcrypt.compare(tryPassword, this.password, cb)
}

export const hashLoginCode = (code) =>
  crypto.createHash('sha256').update(String(code)).digest('hex')

/** Creates a fresh random QR login code, stores its hash, returns the code. */
userSchema.methods.issueLoginCode = function () {
  const code = crypto.randomBytes(18).toString('base64url')
  this.loginCodeHash = hashLoginCode(code)
  this.loginCodeIssuedAt = new Date()
  return code
}

const User = mongoose.model('User', userSchema)

export { User }
