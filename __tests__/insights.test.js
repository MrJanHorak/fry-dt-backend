import { describe, expect, it } from 'vitest'
import { classInsights, expectedOnAimLine, goalStatus, studentInsight } from '../services/insights.js'
import { csvCell, toCsv } from '../services/csv.js'
import { FRY_LISTS } from '../data/fryWords.js'

const NOW = new Date('2026-11-14T15:00:00Z')
const daysAgo = (n, hour = 10) => new Date(NOW.getTime() - n * 86400000 + (hour - 15) * 3600000)
const read = (word, n, extra = {}) => ({
  word,
  wordKey: word.toLowerCase(),
  correct: true,
  automatic: true,
  timed: true,
  skill: 'expressive',
  date: daysAgo(n),
  ...extra
})

describe('goal line', () => {
  const goal = { baselineWords: 10, baselineDate: '2026-10-01', targetWords: 110, targetDate: '2026-12-10' }

  it('interpolates the aim line', () => {
    expect(expectedOnAimLine(goal, new Date('2026-10-01'))).toBe(10)
    expect(expectedOnAimLine(goal, new Date('2026-12-10'))).toBe(110)
    expect(expectedOnAimLine(goal, new Date('2027-01-01'))).toBe(110)
    expect(expectedOnAimLine(null, NOW)).toBeNull()
  })

  it('classifies on track, below and met with a small tolerance', () => {
    const expected = expectedOnAimLine(goal, NOW)
    expect(goalStatus(goal, expected - 2, NOW).status).toBe('on-track')
    expect(goalStatus(goal, expected - 30, NOW)).toMatchObject({ status: 'below', gap: 30 })
    expect(goalStatus(goal, 120, NOW).status).toBe('met')
    expect(goalStatus(undefined, 5, NOW).status).toBe('none')
  })
})

describe('student insight flags', () => {
  const student = { _id: 's1', name: 'Ana' }

  it('flags no practice this week', () => {
    const r = studentInsight(student, [read('the', 20)], { now: NOW })
    expect(r.flags.map((f) => f.code)).toContain('no-practice')
    expect(r.flags[0].text).toBe('No practice in the last 7 days')
  })

  it('flags low accuracy and stalled progress', () => {
    const misses = Array.from({ length: 12 }, (_, i) =>
      read('said', i % 6, { correct: false, automatic: false })
    )
    const r = studentInsight(student, misses, { now: NOW })
    const codes = r.flags.map((f) => f.code)
    expect(codes).toEqual(expect.arrayContaining(['low-accuracy', 'stalled']))
    expect(codes).not.toContain('no-practice')
  })

  it('counts words newly mastered in the period and days practised', () => {
    const words = FRY_LISTS[0].words.slice(0, 4)
    const attempts = words.flatMap((w) => [read(w, 3), read(w, 2), read(w, 1)])
    const r = studentInsight(student, attempts, { now: NOW })
    expect(r.mastered).toBe(4)
    expect(r.masteredGained).toBe(4)
    expect(r.practiceDays).toBe(3)
    expect(r.flags).toEqual([])
  })
})

describe('class insights', () => {
  it('summarises the class and the daily activity', () => {
    const students = [
      { _id: 'a', name: 'Ben' },
      { _id: 'b', name: 'Ana' }
    ]
    const byStudent = new Map([['a', [read('the', 0), read('of', 0), read('and', 1)]]])
    const data = classInsights(students, byStudent, { now: NOW })
    expect(data.totals).toMatchObject({ students: 2, activeStudents: 1, attempts: 3 })
    expect(data.daily).toHaveLength(14)
    expect(data.daily.at(-1)).toMatchObject({ attempts: 2, students: 1 })
    expect(data.students.map((s) => s.name)).toEqual(['Ana', 'Ben'])
    expect(data.attention.map((s) => s.name)).toEqual(['Ana'])
  })
})

describe('CSV', () => {
  it('escapes quotes, commas and blocks formula injection', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell(null)).toBe('')
  })

  it('writes a header and rows with a BOM', () => {
    const csv = toCsv([{ name: 'Émile', n: 3 }], [
      { key: 'name', label: 'Student' },
      { key: 'n', label: 'Words' }
    ])
    expect(csv.startsWith('﻿Student,Words\r\nÉmile,3')).toBe(true)
  })
})
