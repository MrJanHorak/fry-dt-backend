import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const practicedWords = new Schema({
  word: String,
  timesPracticed: { type: Number, default: 0 },
  timesCorrect: { type: Number, default: 0 },
  timesIncorrect: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
});

const profileSchema = new Schema({
  email: { type: String, required: true, lowercase: true },
  name: { type: String, required: true },
  avatar: { type: String, rquired: true },
  grade: { type: Number, required: true },
  role: { type: String, required: true },
  students: [{ type: mongoose.Schema.Types.OnjectId, ref: 'Profile' }],
  pitch: { type: Number, default: 1 },
  rate: { type: Number, default: 1 },
  voice: { type: Number, default: 0 },
  practicedWords: [practicedWords],
  isAdmin: { type: Boolean, default: false },
});

const Profile = mongoose.model('Profile', profileSchema);

export { Profile };
