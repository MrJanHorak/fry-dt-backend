import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.SKIP_DB_CONNECTION = 'true'
process.env.SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

vi.mock('../models/user.js', () => ({
  User: { findOne: vi.fn() },
  hashLoginCode: vi.fn()
}))
vi.mock('../models/profile.js', () => ({
  Profile: { findById: vi.fn(), find: vi.fn(), findOne: vi.fn() }
}))
vi.mock('../models/wordAttempt.js', () => ({
  WordAttempt: { find: vi.fn(), insertMany: vi.fn(), findOneAndUpdate: vi.fn() }
}))
vi.mock('../models/assignment.js', () => ({
  Assignment: { find: vi.fn(), findById: vi.fn(), create: vi.fn() }
}))

const { Profile } = await import('../models/profile.js')
const { WordAttempt } = await import('../models/wordAttempt.js')
const { Assignment } = await import('../models/assignment.js')
const { app } = await import('../server.js')

const teacherId = '507f1f77bcf86cd799439011'
const studentId = '507f1f77bcf86cd799439021'
const strangerId = '507f1f77bcf86cd799439031'

const profiles = {
  [teacherId]: { _id: teacherId, name: 'Ms T', role: 'teacher', students: [studentId] },
  [studentId]: {
    _id: studentId,
    name: 'Emma',
    role: 'student',
    students: [],
    accommodations: { automaticitySeconds: 5 }
  },
  [strangerId]: { _id: strangerId, name: 'Zed', role: 'student', students: [] }
}

const makeQuery = (result) => {
  const q = {
    select: vi.fn(() => q),
    lean: vi.fn(() => q),
    sort: vi.fn(() => q),
    populate: vi.fn(() => q),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  }
  return q
}

const authAs = (id) => ({
  Authorization: `Bearer ${jwt.sign(
    { user: { _id: 'u' + id, profile: id, role: profiles[id].role } },
    process.env.SECRET
  )}`
})

beforeEach(() => {
  vi.clearAllMocks()
  Profile.findById.mockImplementation((id) => makeQuery(profiles[String(id)] || null))
  Profile.find.mockImplementation(() => makeQuery([profiles[studentId]]))
  WordAttempt.find.mockImplementation(() => makeQuery([]))
  WordAttempt.insertMany.mockImplementation(async (docs) => docs)
  Assignment.find.mockImplementation(() => makeQuery([]))
})

describe('GET /api/words/fry', () => {
  it('serves the 10 Fry lists without sign-in', async () => {
    const res = await request(app).get('/api/words/fry')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(10)
  })
})

describe('recording attempts', () => {
  it('works out automaticity on the server using the accommodation', async () => {
    const res = await request(app)
      .post(`/api/progress/${studentId}/attempts`)
      .set(authAs(teacherId))
      .send({
        attempts: [
          { word: 'the', correct: true, responseMs: 4000, context: 'benchmark' },
          { word: 'of', correct: true, responseMs: 6000, context: 'benchmark' },
          { word: 'and', correct: false, responseMs: 1000, context: 'benchmark' }
        ]
      })

    expect(res.status).toBe(201)
    const saved = WordAttempt.insertMany.mock.calls[0][0]
    // 5-second threshold for this student
    expect(saved.map((d) => d.automatic)).toEqual([true, false, false])
    expect(saved[0]).toMatchObject({ scoredBy: 'teacher', context: 'benchmark', fryList: 1 })
  })

  it('lets students log only self-practice, not benchmark results', async () => {
    await request(app)
      .post(`/api/progress/${studentId}/attempts`)
      .set(authAs(studentId))
      .send({ attempts: [{ word: 'the', correct: true, context: 'benchmark', scoredBy: 'teacher' }] })

    const saved = WordAttempt.insertMany.mock.calls[0][0][0]
    expect(saved.context).toBe('practice')
    expect(saved.scoredBy).toBe('self')
  })

  it('rejects attempts for students you do not teach', async () => {
    const res = await request(app)
      .post(`/api/progress/${strangerId}/attempts`)
      .set(authAs(teacherId))
      .send({ attempts: [{ word: 'the', correct: true }] })
    expect(res.status).toBe(403)
  })

  it('validates words and payload size', async () => {
    const bad = await request(app)
      .post(`/api/progress/${studentId}/attempts`)
      .set(authAs(teacherId))
      .send({ attempts: [{ word: '<script>', correct: true }] })
    expect(bad.status).toBe(400)

    const empty = await request(app)
      .post(`/api/progress/${studentId}/attempts`)
      .set(authAs(teacherId))
      .send({ attempts: [] })
    expect(empty.status).toBe(400)
  })
})

describe('summaries and practice', () => {
  it('returns a summary with lists, trend and working list', async () => {
    const res = await request(app)
      .get(`/api/progress/${studentId}/summary`)
      .set(authAs(teacherId))
    expect(res.status).toBe(200)
    expect(res.body.lists).toHaveLength(10)
    expect(res.body.trend).toHaveLength(12)
    expect(res.body.workingList).toBe(1)
    expect(res.body.student.accommodations.automaticitySeconds).toBe(5)
  })

  it('hides accommodations from the student view', async () => {
    const res = await request(app)
      .get(`/api/progress/${studentId}/summary`)
      .set(authAs(studentId))
    expect(res.status).toBe(200)
    expect(res.body.student.accommodations).toBeUndefined()
  })

  it('builds a practice session for a new student', async () => {
    const res = await request(app)
      .get(`/api/progress/${studentId}/practice`)
      .set(authAs(studentId))
    expect(res.status).toBe(200)
    expect(res.body.words.length).toBeGreaterThan(0)
    expect(res.body.words[0]).toMatchObject({ word: 'the', fryList: 1 })
  })

  it('limits the class view to teachers', async () => {
    const asStudent = await request(app).get('/api/progress/class?list=1').set(authAs(studentId))
    expect(asStudent.status).toBe(403)

    const asTeacher = await request(app).get('/api/progress/class?list=1').set(authAs(teacherId))
    expect(asTeacher.status).toBe(200)
    expect(asTeacher.body.words).toHaveLength(100)
    expect(asTeacher.body.rows[0].name).toBe('Emma')
  })
})

describe('insights and exports', () => {
  it('gives teachers class insights', async () => {
    const res = await request(app).get('/api/progress/insights?days=7').set(authAs(teacherId))
    expect(res.status).toBe(200)
    expect(res.body.totals.students).toBe(1)
    expect(res.body.daily).toHaveLength(14)
    expect(res.body.attention[0].flags[0].code).toBe('no-practice')
  })

  it('keeps insights and class exports away from students', async () => {
    expect((await request(app).get('/api/progress/insights').set(authAs(studentId))).status).toBe(403)
    expect((await request(app).get('/api/progress/class/export.csv').set(authAs(studentId))).status).toBe(403)
  })

  it('exports class progress as CSV', async () => {
    const res = await request(app)
      .get('/api/progress/class/export.csv')
      .set(authAs(teacherId))
      .set('Origin', 'http://localhost:3000')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-expose-headers']).toMatch(/Content-Disposition/)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="class-progress-/)
    expect(res.text).toMatch(/Student,Grade,Words mastered/)
    expect(res.text).toMatch(/Emma/)
  })

  it("exports one student's words only for their teacher or themselves", async () => {
    WordAttempt.find.mockImplementation(() =>
      makeQuery([{ word: 'the', wordKey: 'the', correct: true, automatic: true, timed: true, skill: 'expressive', date: new Date() }])
    )
    const res = await request(app).get(`/api/progress/${studentId}/export.csv`).set(authAs(teacherId))
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/Word,Fry list,Status/)
    expect(res.text).toMatch(/the,1,learning/)
    expect((await request(app).get(`/api/progress/${strangerId}/export.csv`).set(authAs(teacherId))).status).toBe(403)
  })
})

describe('assignments', () => {
  it('creates an assignment for your own students with cleaned words', async () => {
    Assignment.create.mockImplementation(async (doc) => ({ _id: 'a1', ...doc }))
    const res = await request(app)
      .post('/api/assignments')
      .set(authAs(teacherId))
      .send({ title: 'Tricky words', students: [studentId], words: ['Said', 'said', ' was ', 'i'] })

    expect(res.status).toBe(201)
    expect(Assignment.create.mock.calls[0][0]).toMatchObject({
      teacher: teacherId,
      words: ['said', 'was', 'I'],
      status: 'active'
    })
  })

  it('refuses to assign to students on another roster', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .set(authAs(teacherId))
      .send({ title: 'x', students: [strangerId], words: ['the'] })
    expect(res.status).toBe(400)
    expect(Assignment.create).not.toHaveBeenCalled()
  })

  it('does not let students create assignments', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .set(authAs(studentId))
      .send({ title: 'x', students: [studentId], words: ['the'] })
    expect(res.status).toBe(403)
  })

  it("blocks editing another teacher's assignment", async () => {
    Assignment.findById.mockResolvedValue({ _id: 'a1', teacher: strangerId })
    const res = await request(app)
      .put('/api/assignments/507f1f77bcf86cd799439099')
      .set(authAs(teacherId))
      .send({ title: 'mine now' })
    expect(res.status).toBe(403)
  })
})
