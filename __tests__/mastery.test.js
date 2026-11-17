import { describe, expect, it } from 'vitest'
import {
  summarizeWord,
  summarizeStudent,
  listBreakdown,
  workingList,
  buildPracticeQueue,
  classMatrix,
  weeklyTrend,
  automaticityRate,
  MASTERY_DAYS
} from '../services/mastery.js'
import { FRY_LISTS, ALL_FRY_WORDS, getFryList, getFryRank } from '../data/fryWords.js'

const day = (n, hour = 10) => new Date(Date.UTC(2026, 9, n, hour))
const read = (word, n, extra = {}) => ({
  word,
  wordKey: word.toLowerCase(),
  correct: true,
  automatic: true,
  timed: true,
  skill: 'expressive',
  date: day(n),
  ...extra
})
const miss = (word, n, extra = {}) =>
  read(word, n, { correct: false, automatic: false, ...extra })

describe('Fry word data', () => {
  it('has 10 lists of 100 unique words', () => {
    expect(FRY_LISTS).toHaveLength(10)
    FRY_LISTS.forEach((l) => expect(l.words).toHaveLength(100))
    expect(new Set(ALL_FRY_WORDS.map((w) => w.toLowerCase())).size).toBe(1000)
  })

  it('contains the corrected words', () => {
    expect(getFryRank('write')).toBe(73)
    expect(getFryRank('oil')).toBe(88)
    expect(getFryRank('man')).toBe(124)
    expect(getFryList('round')).toBe(5)
    expect(getFryRank('I am')).toBeNull()
  })
})

describe('word mastery', () => {
  it('needs automatic correct reads on 3 separate days', () => {
    const twoDays = summarizeWord('the', [read('the', 1), read('the', 1, { date: day(1, 14) }), read('the', 2)], {}, day(3))
    expect(twoDays.status).toBe('learning')
    expect(twoDays.masteryDays).toBe(2)

    const threeDays = summarizeWord('the', [read('the', 1), read('the', 2), read('the', 3)], {}, day(3))
    expect(MASTERY_DAYS).toBe(3)
    expect(threeDays.status).toBe('mastered')
  })

  it('does not count slow (non-automatic) or helped reads', () => {
    const s = summarizeWord('of', [
      read('of', 1, { automatic: false }),
      read('of', 2, { helpUsed: true }),
      read('of', 3)
    ])
    expect(s.masteryDays).toBe(1)
    expect(s.status).toBe('learning')
  })

  it('counts untimed reads on accuracy alone (accommodation)', () => {
    const s = summarizeWord('and', [
      read('and', 1, { timed: false, automatic: false }),
      read('and', 2, { timed: false, automatic: false }),
      read('and', 3, { timed: false, automatic: false })
    ])
    expect(s.status).toBe('mastered')
  })

  it('marks a mastered word for review after a miss', () => {
    const s = summarizeWord('a', [read('a', 1), read('a', 2), read('a', 3), miss('a', 4)])
    expect(s.status).toBe('review')
    expect(s.box).toBe(0)
    expect(s.due).toBe(true)
  })

  it('ignores receptive answers unless the accommodation allows them', () => {
    const attempts = [1, 2, 3].map((n) => read('to', n, { skill: 'receptive' }))
    expect(summarizeWord('to', attempts).status).toBe('not-yet')
    expect(
      summarizeWord('to', attempts, { receptiveCountsForMastery: true }).status
    ).toBe('mastered')
  })

  it('schedules reviews further apart as the word gets stronger', () => {
    const s = summarizeWord('in', [read('in', 1), read('in', 2), read('in', 3)], {}, day(4))
    expect(s.box).toBe(3)
    expect(s.due).toBe(false) // next review 4 days after day 3
    const later = summarizeWord('in', [read('in', 1), read('in', 2), read('in', 3)], {}, day(8))
    expect(later.due).toBe(true)
  })
})

describe('student progress', () => {
  const masteredFirst95 = FRY_LISTS[0].words
    .slice(0, 95)
    .flatMap((w) => [read(w, 1), read(w, 2), read(w, 3)])

  it('breaks progress down by list and finds the working list', () => {
    const summaries = summarizeStudent(masteredFirst95)
    const lists = listBreakdown(summaries)
    expect(lists[0].mastered).toBe(95)
    expect(lists[1]['not-yet']).toBe(100)
    expect(workingList(lists)).toBe(2)
  })

  it('works out a weekly trend and automaticity rate', () => {
    const trend = weeklyTrend(masteredFirst95, {}, 2, day(10))
    expect(trend.at(-1).mastered).toBe(95)
    expect(automaticityRate([read('the', 1), read('of', 1, { automatic: false })], 30, day(2))).toBe(0.5)
  })
})

describe('practice queue', () => {
  it('keeps most words familiar with only a few unknown words', () => {
    const known = FRY_LISTS[0].words.slice(0, 20).flatMap((w) => [read(w, 1), read(w, 2), read(w, 3)])
    const summaries = summarizeStudent(known, {}, day(30))
    const queue = buildPracticeQueue(summaries, {
      workingList: 1,
      accommodations: { wordsPerSession: 10, newWordsPerSession: 3 }
    })
    expect(queue).toHaveLength(10)
    const unknown = queue.filter((w) => !FRY_LISTS[0].words.slice(0, 20).includes(w))
    expect(unknown).toHaveLength(3)
  })

  it('puts assigned words first and respects smaller session sizes', () => {
    const summaries = summarizeStudent([read('the', 1), miss('said', 1)], {}, day(5))
    const queue = buildPracticeQueue(summaries, {
      assignedWords: ['said', 'was'],
      workingList: 1,
      accommodations: { wordsPerSession: 4, newWordsPerSession: 2 }
    })
    expect(queue).toHaveLength(3) // only one familiar word exists yet
    expect(queue).toEqual(expect.arrayContaining(['said', 'was', 'the']))
  })
})

describe('class matrix', () => {
  it('finds most-missed words and groups students who share gaps', () => {
    const students = [
      { _id: 's1', name: 'Ana' },
      { _id: 's2', name: 'Ben' },
      { _id: 's3', name: 'Cy' }
    ]
    const attempts = new Map([
      ['s1', [miss('of', 1), miss('and', 1)]],
      ['s2', [miss('of', 1), miss('and', 1)]],
      ['s3', [read('of', 1), read('of', 2), read('of', 3)]]
    ])
    const result = classMatrix(students, attempts, 1)
    expect(result.rows).toHaveLength(3)
    expect(result.mostMissed[0].needCount).toBe(2)
    expect(result.suggestedGroups[0].students.map((s) => s.name)).toEqual(['Ana', 'Ben'])
    expect(result.rows[2].statuses.of).toBe('mastered')
  })
})
