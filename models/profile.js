import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const practicedWords = new Schema({
  word: String,
  mastered: { type: Boolean },
  timesPracticed: { type: Number, default: 0 },
  timesCorrect: { type: Number, default: 0 },
  timesIncorrect: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
});

const groups = new Schema({
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }],
  commonWords: [practicedWords],
});

const profileSchema = new Schema({
  email: { type: String, required: true, lowercase: true },
  name: { type: String, required: true },
  avatar: { type: String, required: true },
  grade: { type: Number, required: true },
  role: { type: String, required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }],
  groups: [groups],
  pitch: { type: Number, default: 1 },
  rate: { type: Number, default: 1 },
  voice: { type: Number, default: 0 },
  practicedWords: [practicedWords],
  fryGradelevel: { type: String },
  tested: { type: Number, default: 0 },
  isAdmin: { type: Boolean, default: false },
});

const Profile = mongoose.model('Profile', profileSchema);

export { Profile };
