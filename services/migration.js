/**
 * Converts the old per-profile `assessments` history into WordAttempt
 * records so it appears in the new progress reports.
 *
 * Only real, dated responses are converted. The old `practicedWords`
 * counters (times correct/incorrect) have no per-attempt dates, so turning
 * them into attempts would invent data; they are left alone.
 */
import { canonicalWord, getFryList } from '../data/fryWords.js'
import { wordKey } from './mastery.js'

const WORD_PATTERN = /^[A-Za-z][A-Za-z' -]{0,39}$/

export const migrationKey = (assessmentId, index) =>
  `migrated:${assessmentId}:${index}`

/**
 * @param {object} profile  a student Profile (lean) with assessments
 * @returns {object[]}      WordAttempt documents (not yet saved)
 */
export function attemptsFromProfile(profile) {
  const acc = profile.accommodations || {}
  const thresholdMs = (acc.automaticitySeconds || 3) * 1000
  const untimed = Boolean(acc.untimed)
  const out = []

  for (const assessment of profile.assessments || []) {
    const kind = assessment.assessmentData?.sessionType
    const isLive = kind === 'teacher-led-live'
    const isSpelling = assessment.testType === 'spelling'

    ;(assessment.responses || []).forEach((response, index) => {
      const word = typeof response.word === 'string' ? response.word.trim() : ''
      if (!WORD_PATTERN.test(word) || typeof response.correct !== 'boolean') return

      const ms =
        typeof response.timeSpent === 'number' && response.timeSpent > 0
          ? Math.round(response.timeSpent)
          : undefined
      const timed = !untimed && ms !== undefined
      const usedSpeech = Boolean(response.speechData || assessment.assessmentData?.speechAssessment)

      out.push({
        student: profile._id,
        word: canonicalWord(word) || word,
        wordKey: wordKey(word),
        fryList: getFryList(word) || undefined,
        correct: response.correct,
        responseMs: ms,
        timed,
        automatic: response.correct && timed && ms <= thresholdMs,
        // Spelling is not reading the word aloud, so it is not expressive
        skill: isSpelling ? 'receptive' : 'expressive',
        context: isLive ? 'live' : 'practice',
        scoredBy: isLive ? 'teacher' : usedSpeech ? 'speech' : 'self',
        // Old records cannot tell us whether help was used; multiple tries
        // on the same word suggest the first read was not independent
        helpUsed: (response.attempts || 1) > 1,
        // Live sessions keep their real session id so they are not
        // duplicated with records the live room already wrote
        sessionId: isLive && assessment.sessionId
          ? assessment.sessionId
          : migrationKey(assessment._id, index),
        date: assessment.date ? new Date(assessment.date) : new Date(0)
      })
    })
  }
  return out
}

/** Key used to skip records that already exist. */
export const dedupeKey = (attempt) =>
  `${attempt.wordKey}|${attempt.sessionId}|${attempt.context}`
