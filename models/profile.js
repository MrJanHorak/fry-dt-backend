import mongoose from 'mongoose'

const Schema = mongoose.Schema

const practicedWords = new Schema({
  word: String,
  mastered: { type: Boolean },
  timesPracticed: { type: Number, default: 0 },
  timesCorrect: { type: Number, default: 0 },
  timesIncorrect: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  recordOfWrongs: [{ type: String }], // Track wrong attempts
  lastPracticed: { type: Date, default: Date.now },
  speechRecognitionScore: { type: Number, default: 0 }, // 0-100 score for speech recognition
  responseTime: { type: Number, default: 0 } // Average response time in ms
})

// Assessment schema for teacher-conducted tests
const assessment = new Schema({
  testType: {
    type: String,
    enum: ['recognition', 'spelling', 'pronunciation', 'reading'],
    default: 'recognition'
  },
  words: [{ type: String, required: true }], // Array of words tested in this assessment
  responses: [
    {
      word: { type: String, required: true },
      correct: { type: Boolean, required: true },
      timeSpent: { type: Number }, // Time spent on this word in ms
      attempts: { type: Number, default: 1 }
    }
  ],
  score: { type: Number, min: 0, max: 100 }, // Overall score for the assessment
  duration: { type: Number }, // Total duration of assessment in ms
  teacherNotes: { type: String }, // In-person observation notes
  assessmentData: { type: mongoose.Schema.Types.Mixed }, // Additional data storage
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  date: { type: Date, default: Date.now },
  sessionId: { type: String } // To group assessments by session
})

// Test session schema
const testSession = new Schema({
  sessionType: {
    type: String,
    enum: ['individual', 'group', 'practice', 'assessment'],
    required: true
  },
  wordsUsed: [{ type: String }], // Words used in this session
  sessionSettings: {
    timeLimit: { type: Number }, // Time limit in seconds
    wordCount: { type: Number }, // Number of words to test
    testTypes: [
      {
        type: String,
        enum: ['recognition', 'pronunciation', 'spelling', 'reading']
      }
    ]
  },
  results: {
    totalWords: { type: Number, default: 0 },
    correctWords: { type: Number, default: 0 },
    averageResponseTime: { type: Number }, // Average response time in ms
    averageConfidence: { type: Number, min: 0, max: 1 } // Confidence score 0-1
  },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  teacherNotes: { type: String }, // Overall session notes
  fryLevel: { type: Number, default: 1 } // Which FRY list level (1-10)
})

const groups = new Schema({
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }],
  commonWords: [practicedWords]
})

const profileSchema = new Schema(
  {
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
    assessments: [assessment], // Individual word assessments
    testSessions: [testSession], // Complete test sessions
    fryGradelevel: { type: String },
    tested: { type: Number, default: 0 },
    isAdmin: { type: Boolean, default: false },
    // Speech recognition settings
    speechRecognitionEnabled: { type: Boolean, default: true },
    preferredLanguage: { type: String, default: 'en-US' },
    // Learning preferences
    autoAdvance: { type: Boolean, default: false }, // Auto advance to next level when mastered
    dailyGoal: { type: Number, default: 10 }, // Daily practice goal
    currentLevel: { type: Number, default: 1 } // Current FRY level (1-10)
  },
  {
    timestamps: true
  }
)

const Profile = mongoose.model('Profile', profileSchema)

export { Profile }
