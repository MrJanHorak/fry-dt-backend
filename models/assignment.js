import mongoose from 'mongoose'

/**
 * A set of practice words a teacher assigns to one or more students,
 * e.g. "Tricky words for Group B" or "Emma: list 2, group 1".
 */
const assignmentSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile',
      required: true
    },
    students: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true }
    ],
    title: { type: String, required: true, trim: true, maxlength: 80 },
    note: { type: String, trim: true, maxlength: 300 }, // shown to the student
    words: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      validate: [
        (words) => words.length >= 1 && words.length <= 50,
        'An assignment needs between 1 and 50 words'
      ]
    },
    // Activities the student may use. Teachers can limit these per assignment.
    activities: {
      type: [
        {
          type: String,
          enum: ['flashcards', 'listen-find', 'build-word', 'read-aloud']
        }
      ],
      default: ['flashcards', 'listen-find', 'build-word']
    },
    // "Done" means each word read correctly on this many separate days
    targetDays: { type: Number, min: 1, max: 10, default: 3 },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active'
    }
  },
  { timestamps: true }
)

assignmentSchema.index({ teacher: 1, status: 1 })
assignmentSchema.index({ students: 1, status: 1 })

export const Assignment = mongoose.model('Assignment', assignmentSchema)
