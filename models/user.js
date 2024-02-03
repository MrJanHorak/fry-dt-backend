import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 6;

/**
 * User Schema
 * @typedef {Object} UserSchema
 * @property {string} name - The name of the user.
 * @property {string} email - The email of the user.
 * @property {string} password - The password of the user.
 * @property {mongoose.Schema.Types.ObjectId} profile - The profile of the user.
 * @property {string} role - The role of the user.
 * @property {Date} createdAt - The date when the user was created.
 * @property {Date} updatedAt - The date when the user was last updated.
 */
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, required: true, lowercase: true },
    password: String,
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
    role: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    return ret;
  },
});

userSchema.pre('save', function (next) {
  const user = this;
  if (!user.isModified('password') || user.role === 'student') return next();
  bcrypt
    .hash(user.password, SALT_ROUNDS)
    .then((hash) => {
      user.password = hash;
      next();
    })
    .catch((err) => {
      console.log(err);
      next(err);
    });
});

userSchema.methods.comparePassword = function (tryPassword, cb) {
  bcrypt.compare(tryPassword, this.password, cb);
};

const User = mongoose.model('User', userSchema);

export { User };
