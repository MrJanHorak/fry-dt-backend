import { describe, expect, it } from 'vitest'
import { attemptsFromProfile, dedupeKey } from '../services/migration.js'
import { summarizeStudent } from '../services/mastery.js'

const profile = {
  _id: 'stu1',
  accommodations: { automaticitySeconds: 3 },
  assessments: [
    {
      _id: 'a1',
      testType: 'recognition',
      date: '2026-09-01T10:00:00Z',
      assessmentData: { sessionType: 'practice' },
      responses: [{ word: 'the', correct: true, timeSpent: 1200, attempts: 1 }]
    },
    {
      _id: 'a2',
      testType: 'reading',
      date: '2026-09-02T10:00:00Z',
      sessionId: 'SESSION-ABC',
      assessmentData: { sessionType: 'teacher-led-live' },
      responses: [{ word: 'Said', correct: true, timeSpent: 5000, attempts: 1 }]
    },
    {
      _id: 'a3',
      testType: 'spelling',
      date: '2026-09-03T10:00:00Z',
      responses: [
        { word: 'of', correct: true, timeSpent: 900, attempts: 2 },
        { word: '<bad>', correct: true },
        { word: 'and' } // no result recorded
      ]
    }
  ]
}

describe('history migration', () => {
  const attempts = attemptsFromProfile(profile)

  it('converts only valid, dated responses', () => {
    expect(attempts.map((a) => a.word)).toEqual(['the', 'said', 'of'])
    expect(attempts[0].date.toISOString()).toBe('2026-09-01T10:00:00.000Z')
  })

  it('keeps context, scorer and automaticity sensible', () => {
    expect(attempts[0]).toMatchObject({ context: 'practice', scoredBy: 'self', automatic: true, skill: 'expressive' })
    expect(attempts[1]).toMatchObject({ context: 'live', scoredBy: 'teacher', automatic: false, sessionId: 'SESSION-ABC' })
    expect(attempts[2]).toMatchObject({ skill: 'receptive', helpUsed: true })
  })

  it('produces stable keys so re-running skips existing records', () => {
    const again = attemptsFromProfile(profile)
    expect(again.map(dedupeKey)).toEqual(attempts.map(dedupeKey))
    expect(new Set(attempts.map(dedupeKey)).size).toBe(attempts.length)
  })

  it('feeds the mastery engine', () => {
    const summaries = summarizeStudent(attempts)
    expect(summaries.get('the').status).toBe('learning')
  })
})
