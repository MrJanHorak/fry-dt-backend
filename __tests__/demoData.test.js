import { describe, expect, it } from 'vitest'
import { generateDemo } from '../services/demoData.js'
import { classInsights } from '../services/insights.js'

const NOW = new Date('2026-11-14T15:00:00Z')

describe('demo data', () => {
  const demo = generateDemo({ now: NOW })
  const byStudent = new Map(demo.students.map((s) => [s.name, s.attempts]))
  const students = demo.students.map((s) => ({ ...s, _id: s.name }))
  const insights = classInsights(students, byStudent, { now: NOW })
  const row = (name) => insights.students.find((s) => s.name === name)
  const codes = (name) => row(name).flags.map((f) => f.code)

  it('is deterministic', () => {
    const again = generateDemo({ now: NOW })
    expect(again.students.map((s) => s.attempts.length)).toEqual(
      demo.students.map((s) => s.attempts.length)
    )
  })

  it('creates six clearly fictional students with history', () => {
    expect(demo.students).toHaveLength(6)
    expect(demo.teacher.email).toMatch(/\.invalid$/)
    demo.students.forEach((s) => {
      expect(s.name.startsWith('Demo-')).toBe(true)
      expect(s.attempts.length).toBeGreaterThan(50)
    })
  })

  it('produces the situations the dashboard should show', () => {
    expect(codes('Demo-Dev')).toContain('no-practice')
    expect(codes('Demo-Cleo')).toEqual(expect.arrayContaining(['low-accuracy']))
    expect(codes('Demo-Ben')).toEqual([])
    expect(row('Demo-Ben').mastered).toBeGreaterThan(row('Demo-Cleo').mastered)
    expect(row('Demo-Eli').automaticityRate).toBeNull() // untimed: not measured
    expect(row('Demo-Fay').mastered).toBeGreaterThan(0) // receptive counts for her
    expect(insights.totals.activeStudents).toBe(5)
  })

  it('never marks untimed attempts as automatic or timed', () => {
    const eli = demo.students.find((s) => s.name === 'Demo-Eli')
    expect(eli.attempts.every((a) => a.timed === false && a.automatic === false)).toBe(true)
  })
})
