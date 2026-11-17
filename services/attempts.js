import { WordAttempt } from '../models/wordAttempt.js'
import { Profile } from '../models/profile.js'
import { getFryList, canonicalWord } from '../data/fryWords.js'
import { wordKey } from './mastery.js'

/**
 * Records (or updates) a teacher-judged attempt from the live testing room,
 * so live sessions count toward the same mastery data as benchmarks.
 * One record per student/word/session; re-scoring updates it.
 */
export async function upsertLiveAttempt({
  studentId,
  teacherId,
  word,
  correct,
  responseMs,
  sessionId,
  errorResponse
}) {
  if (!studentId || !word || !sessionId) return null

  const student = await Profile.findById(studentId)
    .select('accommodations')
    .lean()
  const acc = student?.accommodations || {}
  const thresholdMs = (acc.automaticitySeconds || 3) * 1000
  const ms =
    typeof responseMs === 'number' && responseMs >= 0 ? Math.round(responseMs) : undefined
  const timed = !acc.untimed && ms !== undefined

  return WordAttempt.findOneAndUpdate(
    { student: studentId, wordKey: wordKey(word), sessionId, context: 'live' },
    {
      $set: {
        recordedBy: teacherId,
        word: canonicalWord(word) || word,
        fryList: getFryList(word) || undefined,
        correct: Boolean(correct),
        responseMs: ms,
        timed,
        automatic: Boolean(correct) && timed && ms <= thresholdMs,
        skill: 'expressive',
        scoredBy: 'teacher',
        errorResponse:
          typeof errorResponse === 'string' ? errorResponse.slice(0, 60) : undefined,
        date: new Date()
      }
    },
    { upsert: true, new: true }
  )
}
