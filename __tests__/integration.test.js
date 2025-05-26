import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../server.js'
import { User } from '../models/user.js'
import { Profile } from '../models/profile.js'
import jwt from 'jsonwebtoken'

describe('API Integration Tests', () => {
  let testUser
  let testProfile
  let authToken

  beforeEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: /test/ })
    await Profile.deleteMany({ email: /test/ })

    // Create test profile and user
    testProfile = await Profile.create({
      name: 'Test User',
      email: 'test@example.com',
      avatar: 'test-avatar.png',
      grade: 3,
      role: 'student',
      practicedWords: []
    })

    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'testpassword',
      profile: testProfile._id,
      role: 'student'
    })

    // Generate auth token
    authToken = jwt.sign({ user: testUser._id }, process.env.SECRET, {
      expiresIn: '24h'
    })
  })

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: /test/ })
    await Profile.deleteMany({ email: /test/ })
  })

  describe('Auth Endpoints', () => {
    it('should signup a new user successfully', async () => {
      const newUser = {
        name: 'New Test User',
        email: 'newtest@example.com',
        password: 'newpassword',
        avatar: 'new-avatar.png',
        grade: 4,
        role: 'student'
      }

      const response = await request(app)
        .post('/api/auth/signup')
        .send(newUser)
        .expect(201)

      expect(response.body).toHaveProperty('token')

      // Verify user was created
      const createdUser = await User.findOne({ email: newUser.email })
      expect(createdUser).toBeTruthy()
      expect(createdUser.name).toBe(newUser.name)
    })

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'testpassword'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200)

      expect(response.body).toHaveProperty('token')
    })

    it('should reject login with invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(400)

      expect(response.body).toHaveProperty('err')
    })

    it('should validate required fields on signup', async () => {
      const incompleteUser = {
        name: 'Incomplete User'
        // Missing email, password, etc.
      }

      const response = await request(app)
        .post('/api/auth/signup')
        .send(incompleteUser)
        .expect(400)

      expect(response.body).toHaveProperty('err')
      expect(response.body.err).toMatch(/required fields/i)
    })
  })

  describe('Profile Endpoints', () => {
    it('should get profile by ID with authentication', async () => {
      const response = await request(app)
        .get(`/api/profiles/${testProfile._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body).toHaveProperty('_id', testProfile._id.toString())
      expect(response.body).toHaveProperty('name', 'Test User')
      expect(response.body).toHaveProperty('email', 'test@example.com')
    })

    it('should reject unauthorized profile access', async () => {
      const response = await request(app)
        .get(`/api/profiles/${testProfile._id}`)
        .expect(401)

      expect(response.body).toHaveProperty('err')
    })

    it('should update profile with valid data', async () => {
      const updateData = {
        name: 'Updated Test User',
        grade: 4
      }

      const response = await request(app)
        .put(`/api/profiles/${testProfile._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body).toHaveProperty('name', 'Updated Test User')
      expect(response.body).toHaveProperty('grade', 4)
    })

    it('should add practiced word to profile', async () => {
      const wordData = {
        word: 'test',
        mastered: false,
        timesPracticed: 1,
        timesCorrect: 1,
        timesIncorrect: 0,
        streak: 1
      }

      const response = await request(app)
        .post(`/api/profiles/${testProfile._id}/practicedWords`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(wordData)
        .expect(200)

      expect(response.body).toBeInstanceOf(Array)
      expect(response.body[0]).toHaveProperty('word', 'test')
    })

    it('should validate practiced word data', async () => {
      const invalidWordData = {
        word: '', // Empty word should fail validation
        timesPracticed: -1 // Negative value should fail
      }

      const response = await request(app)
        .post(`/api/profiles/${testProfile._id}/practicedWords`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidWordData)
        .expect(400)

      expect(response.body).toHaveProperty('err')
    })

    it('should update practiced word correctly', async () => {
      // First add a word
      const wordData = {
        word: 'update-test',
        mastered: false,
        timesPracticed: 1,
        timesCorrect: 0,
        timesIncorrect: 1,
        streak: 0
      }

      const addResponse = await request(app)
        .post(`/api/profiles/${testProfile._id}/practicedWords`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(wordData)
        .expect(200)

      const wordId = addResponse.body[0]._id

      // Now update it
      const updateData = {
        word: 'update-test',
        mastered: true,
        timesPracticed: 2,
        timesCorrect: 1,
        timesIncorrect: 1,
        streak: 1
      }

      const updateResponse = await request(app)
        .put(`/api/profiles/${testProfile._id}/practicedWords/${wordId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)

      expect(updateResponse.body).toHaveProperty('mastered', true)
      expect(updateResponse.body).toHaveProperty('timesPracticed', 2)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid MongoDB ObjectIds', async () => {
      const invalidId = 'invalid-object-id'

      const response = await request(app)
        .get(`/api/profiles/${invalidId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body).toHaveProperty('err')
      expect(response.body.err).toMatch(/invalid/i)
    })

    it('should handle non-existent profile IDs', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011' // Valid ObjectId format but doesn't exist

      const response = await request(app)
        .get(`/api/profiles/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      expect(response.body).toHaveProperty('err')
      expect(response.body.err).toMatch(/not found/i)
    })

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400)

      expect(response.body).toHaveProperty('err')
    })
  })

  describe('Rate Limiting and Security', () => {
    it('should handle multiple rapid requests gracefully', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get(`/api/profiles/${testProfile._id}`)
          .set('Authorization', `Bearer ${authToken}`)
      )

      const responses = await Promise.all(requests)

      // All should succeed (no rate limiting in test environment)
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })
    })

    it('should validate JWT tokens properly', async () => {
      const invalidToken = 'invalid.jwt.token'

      const response = await request(app)
        .get(`/api/profiles/${testProfile._id}`)
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401)

      expect(response.body).toHaveProperty('err')
    })

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { user: testUser._id },
        process.env.SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      )

      const response = await request(app)
        .get(`/api/profiles/${testProfile._id}`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401)

      expect(response.body).toHaveProperty('err')
    })
  })

  describe('Student Management', () => {
    it('should add student to parent profile', async () => {
      // Create parent user
      const parentProfile = await Profile.create({
        name: 'Parent User',
        email: 'parent@example.com',
        avatar: 'parent-avatar.png',
        grade: 1,
        role: 'parent',
        students: []
      })

      const parentUser = await User.create({
        name: 'Parent User',
        email: 'parent@example.com',
        password: 'parentpassword',
        profile: parentProfile._id,
        role: 'parent'
      })

      const parentToken = jwt.sign(
        { user: parentUser._id },
        process.env.SECRET,
        { expiresIn: '24h' }
      )

      const studentData = {
        name: 'Child User',
        email: 'parent@example.com', // Same as parent
        grade: 2,
        role: 'student',
        avatar: 'child-avatar.png'
      }

      const response = await request(app)
        .post('/api/auth/addStudent')
        .set('Authorization', `Bearer ${parentToken}`)
        .send(studentData)
        .expect(201)

      expect(response.body).toHaveProperty('token')

      // Verify student was added to parent's profile
      const updatedParentProfile = await Profile.findById(
        parentProfile._id
      ).populate('students')
      expect(updatedParentProfile.students).toHaveLength(1)
      expect(updatedParentProfile.students[0].name).toBe('Child User')
    })
  })
})
