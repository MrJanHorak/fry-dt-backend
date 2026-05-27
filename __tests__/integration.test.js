import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.SKIP_DB_CONNECTION = 'true'
process.env.SECRET = 'test-secret'

vi.mock('../models/user.js', () => ({
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
    findByIdAndDelete: vi.fn()
  }
}))

vi.mock('../models/profile.js', () => ({
  Profile: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn()
  }
}))

const { User } = await import('../models/user.js')
const { Profile } = await import('../models/profile.js')
const { app } = await import('../server.js')

const profileId = '507f1f77bcf86cd799439011'

const createAuthedRequest = () => {
  const token = jwt.sign(
    {
      user: {
        _id: '507f1f77bcf86cd799439012',
        profile: profileId,
        role: 'teacher'
      }
    },
    process.env.SECRET,
    { expiresIn: '24h' }
  )

  return { Authorization: `Bearer ${token}` }
}

const createPopulateQuery = (result) => ({
  populate: vi.fn().mockResolvedValue(result)
})

describe('API integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Auth endpoints', () => {
    it('signs up a new user successfully', async () => {
      Profile.findOne.mockResolvedValue(null)
      Profile.create.mockResolvedValue({ _id: profileId })
      User.create.mockResolvedValue({ _id: '507f1f77bcf86cd799439099' })

      const response = await request(app).post('/api/auth/signup').send({
        name: 'New Test User',
        email: 'newtest@example.com',
        password: 'newpassword',
        avatar: 'new-avatar.png',
        grade: 4,
        role: 'student'
      })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('token')
      expect(Profile.create).toHaveBeenCalled()
      expect(User.create).toHaveBeenCalled()
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

    it('logs in with valid credentials', async () => {
      User.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439013',
        comparePassword: (_password, callback) => callback(null, true)
      })

      const response = await request(app).post('/api/auth/login').send({
        name: 'Test User',
        pw: 'testpassword'
      })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('token')
    })

    it('rejects login with invalid credentials', async () => {
      User.findOne.mockResolvedValue({
        _id: '507f1f77bcf86cd799439013',
        comparePassword: (_password, callback) => callback(null, false)
      })

      const response = await request(app).post('/api/auth/login').send({
        name: 'Test User',
        pw: 'wrongpassword'
      })

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('err', 'Invalid credentials')
    })
  })

  describe('Profile endpoints', () => {
    it('gets a profile by id with authentication', async () => {
      Profile.findById.mockReturnValue(
        createPopulateQuery({
          _id: profileId,
          name: 'Test User',
          email: 'test@example.com',
          students: []
        })
      )

      const response = await request(app)
        .get(`/api/profiles/${profileId}`)
        .set(createAuthedRequest())

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        _id: profileId,
        name: 'Test User',
        email: 'test@example.com'
      })
    })

    it('rejects unauthorized profile access', async () => {
      const response = await request(app).get(`/api/profiles/${profileId}`)

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('err', 'Not Authorized')
    })

    it('updates a profile with valid data', async () => {
      Profile.findByIdAndUpdate.mockResolvedValue({
        _id: profileId,
        name: 'Updated Test User',
        grade: 4
      })

      const response = await request(app)
        .put(`/api/profiles/${profileId}`)
        .set(createAuthedRequest())
        .send({
          name: 'Updated Test User',
          grade: 4
        })

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        name: 'Updated Test User',
        grade: 4
      })
    })

    it('adds a practiced word to a profile', async () => {
      const save = vi.fn().mockResolvedValue(undefined)
      const profile = {
        practicedWords: [],
        save
      }
      Profile.findById.mockResolvedValue(profile)

      const response = await request(app)
        .post(`/api/profiles/${profileId}/practicedWords`)
        .set(createAuthedRequest())
        .send({
          word: 'test',
          mastered: false,
          timesPracticed: 1,
          timesCorrect: 1,
          timesIncorrect: 0,
          streak: 1
        })

      expect(response.status).toBe(200)
      expect(response.body).toEqual([
        expect.objectContaining({
          word: 'test',
          timesPracticed: 1
        })
      ])
      expect(save).toHaveBeenCalled()
    })

    it('validates practiced word payloads', async () => {
      const response = await request(app)
        .post(`/api/profiles/${profileId}/practicedWords`)
        .set(createAuthedRequest())
        .send({
          word: '',
          timesPracticed: -1
        })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('err', 'Validation failed')
    })
  })

  describe('Error handling', () => {
    it('rejects invalid MongoDB object ids', async () => {
      const response = await request(app)
        .get('/api/profiles/invalid-object-id')
        .set(createAuthedRequest())

      expect(response.status).toBe(400)
      expect(response.body.err).toMatch(/invalid id/i)
    })

    it('returns not found for missing profiles', async () => {
      Profile.findById.mockReturnValue(createPopulateQuery(null))

      const response = await request(app)
        .get(`/api/profiles/${profileId}`)
        .set(createAuthedRequest())

      expect(response.status).toBe(404)
      expect(response.body).toHaveProperty('err', 'Profile not found')
    })

    it('rejects invalid jwt tokens', async () => {
      const response = await request(app)
        .get(`/api/profiles/${profileId}`)
        .set('Authorization', 'Bearer invalid.jwt.token')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('err', 'Invalid token')
    })
  })
})
