import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

process.env.SKIP_DB_CONNECTION = 'true'
process.env.SECRET = 'test-secret'
process.env.NODE_ENV = 'test'

vi.mock('../models/user.js', () => ({
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
    findByIdAndDelete: vi.fn()
  },
  hashLoginCode: (code) =>
    crypto.createHash('sha256').update(String(code)).digest('hex')
}))

vi.mock('../models/profile.js', () => ({
  Profile: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn()
  }
}))

const { User } = await import('../models/user.js')
const { Profile } = await import('../models/profile.js')
const { app } = await import('../server.js')

// --- fixtures -------------------------------------------------------------
const teacherId = '507f1f77bcf86cd799439011'
const studentId = '507f1f77bcf86cd799439021'
const strangerId = '507f1f77bcf86cd799439031'

const profiles = {
  [teacherId]: {
    _id: teacherId,
    name: 'Ms Teacher',
    email: 'teacher@example.com',
    role: 'teacher',
    isAdmin: false,
    students: [studentId]
  },
  [studentId]: {
    _id: studentId,
    name: 'Emma',
    role: 'student',
    isAdmin: false,
    students: []
  },
  [strangerId]: {
    _id: strangerId,
    name: 'Other Kid',
    role: 'student',
    isAdmin: false,
    students: []
  }
}

/** A chainable, awaitable stand-in for a Mongoose query. */
const makeQuery = (result) => {
  const query = {
    select: vi.fn(() => query),
    lean: vi.fn(() => query),
    populate: vi.fn(() => query),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  }
  return query
}

const tokenFor = (profileId, role = profiles[profileId]?.role) =>
  jwt.sign(
    { user: { _id: 'u-' + profileId, profile: profileId, role } },
    process.env.SECRET,
    { expiresIn: '1h' }
  )

const authAs = (profileId) => ({
  Authorization: `Bearer ${tokenFor(profileId)}`
})

describe('API integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Profile.findById.mockImplementation((id) =>
      makeQuery(profiles[String(id)] || null)
    )
    User.findOne.mockImplementation(() => makeQuery(null))
  })

  describe('Auth endpoints', () => {
    it('signs up a new teacher successfully', async () => {
      Profile.findOne.mockResolvedValue(null)
      Profile.create.mockResolvedValue({ _id: teacherId })
      User.create.mockResolvedValue({
        _id: 'u1',
        name: 'New Teacher',
        role: 'teacher',
        profile: teacherId
      })

      const response = await request(app).post('/api/auth/signup').send({
        name: 'New Teacher',
        email: 'newtest@example.com',
        password: 'newpassword',
        role: 'teacher'
      })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('token')
    })

    it('ignores privilege fields such as isAdmin at signup', async () => {
      Profile.findOne.mockResolvedValue(null)
      Profile.create.mockResolvedValue({ _id: teacherId })
      User.create.mockResolvedValue({ _id: 'u1', role: 'teacher' })

      await request(app).post('/api/auth/signup').send({
        name: 'Sneaky',
        email: 'sneaky@example.com',
        password: 'password1',
        role: 'teacher',
        isAdmin: true,
        students: [strangerId]
      })

      const created = Profile.create.mock.calls[0][0]
      expect(created).not.toHaveProperty('isAdmin')
      expect(created).not.toHaveProperty('students')
    })

    it('does not allow students to self-register', async () => {
      const response = await request(app).post('/api/auth/signup').send({
        name: 'Kid',
        email: 'kid@example.com',
        password: 'password1',
        role: 'student'
      })
      expect(response.status).toBe(400)
    })

    it('rejects signup when required fields are missing', async () => {
      const response = await request(app).post('/api/auth/signup').send({
        name: 'Incomplete User'
      })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('err', 'Validation failed')
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/email/i),
          expect.stringMatching(/password/i)
        ])
      )
    })

    it('logs in with valid credentials and issues a minimal token', async () => {
      User.findOne.mockImplementation(() =>
        makeQuery({
          _id: 'u-teacher',
          name: 'Ms Teacher',
          role: 'teacher',
          profile: teacherId,
          password: 'hash',
          comparePassword: (_password, callback) => callback(null, true)
        })
      )

      const response = await request(app).post('/api/auth/login').send({
        name: 'Ms Teacher',
        pw: 'testpassword'
      })

      expect(response.status).toBe(200)
      const decoded = jwt.decode(response.body.token)
      expect(decoded.user).toEqual({
        _id: 'u-teacher',
        name: 'Ms Teacher',
        role: 'teacher',
        profile: teacherId
      })
    })

    it('rejects login with invalid credentials', async () => {
      User.findOne.mockImplementation(() =>
        makeQuery({
          _id: 'u1',
          comparePassword: (_password, callback) => callback(null, false)
        })
      )

      const response = await request(app).post('/api/auth/login').send({
        name: 'Test User',
        pw: 'wrongpassword'
      })

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('err', 'Invalid credentials')
    })

    it('signs a student in with a valid QR login card', async () => {
      const code = 'abc123-secret'
      User.findOne.mockImplementation(() =>
        makeQuery({
          _id: 'u-student',
          name: 'Emma',
          role: 'student',
          profile: studentId,
          loginCodeHash: crypto.createHash('sha256').update(code).digest('hex')
        })
      )

      const ok = await request(app)
        .post('/api/auth/qr-login')
        .send({ name: 'Emma', code })
      expect(ok.status).toBe(200)
      expect(ok.body).toHaveProperty('token')

      const bad = await request(app)
        .post('/api/auth/qr-login')
        .send({ name: 'Emma', code: 'wrong' })
      expect(bad.status).toBe(401)
    })

    it('only lets teachers/parents add students', async () => {
      const response = await request(app)
        .post('/api/auth/addStudent')
        .set(authAs(studentId))
        .send({ name: 'New Kid', grade: 1 })
      expect(response.status).toBe(403)
    })

    it('prevents changing passwords of students on another roster', async () => {
      const response = await request(app)
        .post('/api/auth/changePassword')
        .set(authAs(teacherId))
        .send({ student: strangerId, newPw: 'newpass123' })
      expect(response.status).toBe(403)
    })

    it('only issues QR login cards for your own students', async () => {
      const response = await request(app)
        .post(`/api/auth/students/${strangerId}/login-card`)
        .set(authAs(teacherId))
      expect(response.status).toBe(403)
    })
  })

  describe('Profile authorization', () => {
    it('lets a user read their own profile', async () => {
      const response = await request(app)
        .get(`/api/profiles/${teacherId}`)
        .set(authAs(teacherId))

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({ _id: teacherId })
    })

    it("lets a teacher read their student's profile", async () => {
      const response = await request(app)
        .get(`/api/profiles/${studentId}`)
        .set(authAs(teacherId))
      expect(response.status).toBe(200)
    })

    it('blocks reading a profile that is not yours or your student', async () => {
      const response = await request(app)
        .get(`/api/profiles/${strangerId}`)
        .set(authAs(teacherId))
      expect(response.status).toBe(403)
    })

    it('blocks a student from reading another student', async () => {
      const response = await request(app)
        .get(`/api/profiles/${strangerId}`)
        .set(authAs(studentId))
      expect(response.status).toBe(403)
    })

    it('rejects unauthenticated profile access', async () => {
      const response = await request(app).get(`/api/profiles/${teacherId}`)

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('err', 'Not Authorized')
    })

    it('does not accept tokens in the query string', async () => {
      const response = await request(app).get(
        `/api/profiles/${teacherId}?token=${tokenFor(teacherId)}`
      )
      expect(response.status).toBe(401)
    })

    it('restricts listing all profiles to admins', async () => {
      const response = await request(app)
        .get('/api/profiles')
        .set(authAs(teacherId))
      expect(response.status).toBe(403)
    })

    it('strips privilege fields from profile updates', async () => {
      Profile.findByIdAndUpdate.mockResolvedValue({
        _id: teacherId,
        name: 'Updated'
      })

      const response = await request(app)
        .put(`/api/profiles/${teacherId}`)
        .set(authAs(teacherId))
        .send({ name: 'Updated', isAdmin: true, role: 'admin', students: [] })

      expect(response.status).toBe(200)
      const [, update] = Profile.findByIdAndUpdate.mock.calls[0]
      expect(update).toEqual({ $set: { name: 'Updated' } })
    })

    it("lets a teacher set their student's level but not a student themselves", async () => {
      Profile.findByIdAndUpdate.mockResolvedValue({ _id: studentId })

      await request(app)
        .put(`/api/profiles/${studentId}`)
        .set(authAs(teacherId))
        .send({ currentLevel: 3 })
      expect(Profile.findByIdAndUpdate.mock.calls[0][1]).toEqual({
        $set: { currentLevel: 3 }
      })

      const selfAttempt = await request(app)
        .put(`/api/profiles/${studentId}`)
        .set(authAs(studentId))
        .send({ currentLevel: 10 })
      expect(selfAttempt.status).toBe(400)
    })

    it('blocks updating a stranger', async () => {
      const response = await request(app)
        .put(`/api/profiles/${strangerId}`)
        .set(authAs(teacherId))
        .send({ name: 'Hacked' })
      expect(response.status).toBe(403)
      expect(Profile.findByIdAndUpdate).not.toHaveBeenCalled()
    })

    it('adds a practiced word to your own profile', async () => {
      const save = vi.fn().mockResolvedValue(undefined)
      const studentDoc = { ...profiles[studentId], practicedWords: [], save }
      Profile.findById.mockImplementation((id) =>
        makeQuery(String(id) === studentId ? studentDoc : profiles[id])
      )

      const response = await request(app)
        .post(`/api/profiles/${studentId}/practicedWords`)
        .set(authAs(studentId))
        .send({
          word: 'the',
          mastered: false,
          timesPracticed: 1,
          timesCorrect: 1,
          timesIncorrect: 0,
          streak: 1
        })

      expect(response.status).toBe(200)
      expect(response.body).toEqual([
        expect.objectContaining({ word: 'the', timesPracticed: 1 })
      ])
      expect(save).toHaveBeenCalled()
    })

    it('validates practiced word payloads', async () => {
      const response = await request(app)
        .post(`/api/profiles/${studentId}/practicedWords`)
        .set(authAs(studentId))
        .send({ word: '', timesPracticed: -1 })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('err', 'Validation failed')
    })
  })

  describe('Admin-only monitoring', () => {
    it('keeps health checks public', async () => {
      const response = await request(app).get('/api/performance/health')
      expect(response.status).toBe(200)
    })

    it('blocks non-admins from monitoring data', async () => {
      const response = await request(app)
        .get('/api/database/indexes')
        .set(authAs(teacherId))
      expect(response.status).toBe(403)
    })
  })

  describe('Error handling', () => {
    it('rejects invalid MongoDB object ids', async () => {
      const response = await request(app)
        .get('/api/profiles/invalid-object-id')
        .set(authAs(teacherId))

      expect(response.status).toBe(400)
      expect(response.body.err).toMatch(/invalid id/i)
    })

    it('rejects invalid jwt tokens', async () => {
      const response = await request(app)
        .get(`/api/profiles/${teacherId}`)
        .set('Authorization', 'Bearer invalid.jwt.token')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('err', 'Invalid token')
    })
  })
})
