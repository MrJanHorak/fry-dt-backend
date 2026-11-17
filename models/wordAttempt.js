import mongoose from 'mongoose'

/**
 * One child reading (or finding) one word one time.
 *
 * Stored in its own collection (instead of inside the Profile document) so a
 * student's history can grow for years without hitting MongoDB's 16 MB
 * document limit, and so class-wide reports are a single indexed query.
 */
const wordAttemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true
    },
    // Who recorded it: the student (self-practice) or an adult (assessment)
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },

    word: { type: String, required: true, trim: true },
    wordKey: { type: String, required: true, lowercase: true, trim: true },
    fryList: { type: Number, min: 1, max: 10 }, // null for custom words

    correct: { type: Boolean, required: true },
    // Milliseconds from the word appearing to the response (if measured)
    responseMs: { type: Number, min: 0 },
    // Read correctly within the student's automaticity threshold
    automatic: { type: Boolean, default: false },
    timed: { type: Boolean, default: true },

    /**
     * expressive = the child said/read the word aloud (what Fry mastery means)
     * receptive  = the child heard the word and picked it out (listen & find)
     */
    skill: {
      type: String,
      enum: ['expressive', 'receptive'],
      default: 'expressive'
    },
    /**
     * benchmark  = teacher-scored 1:1 or group assessment
     * practice   = self-paced practice
     * live       = live testing room
     */
    context: {
      type: String,
      enum: ['benchmark', 'practice', 'live'],
      default: 'practice'
    },
    // How the response was judged
    scoredBy: {
      type: String,
      enum: ['teacher', 'self', 'speech', 'choice'],
      default: 'teacher'
    },
    errorResponse: { type: String, maxlength: 60 }, // what the child said instead
    helpUsed: { type: Boolean, default: false }, // heard the word first, etc.

    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    sessionId: { type: String },
    date: { type: Date, default: Date.now }
  },
  { timestamps: false, versionKey: false }
)

wordAttemptSchema.index({ student: 1, wordKey: 1, date: -1 })
wordAttemptSchema.index({ student: 1, date: -1 })
wordAttemptSchema.index({ assignment: 1 })

export const WordAttempt = mongoose.model('WordAttempt', wordAttemptSchema)
