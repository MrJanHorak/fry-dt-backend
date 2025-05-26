# FRY Diagnosis Tool - Backend API

A comprehensive Node.js/Express backend for the FRY Sight Words Diagnosis Tool, providing advanced speech recognition, real-time monitoring, and assessment capabilities for educational environments.

## 🌟 Features

### Core Functionality

- **JWT-based Authentication** - Secure teacher and student login system
- **Real-time Communication** - Socket.IO integration for live testing sessions
- **Speech Recognition Monitoring** - Track student pronunciation practice in real-time
- **Comprehensive Assessment System** - Multiple test types with detailed analytics
- **QR Code Authentication** - Streamlined student login process
- **Performance Monitoring** - Built-in metrics and error tracking
- **Production-Ready Deployment** - Docker containerization with health checks

### Advanced Capabilities

- **Multi-modal Testing** - Recognition, pronunciation, spelling, and reading tests
- **Teacher Dashboard Integration** - Real-time student monitoring and progress tracking
- **Fuzzy Matching Algorithm** - Advanced speech recognition with confidence scoring
- **Progress Analytics** - Detailed student performance analysis and reporting
- **Session Management** - Comprehensive test session tracking and history
- **Database Optimization** - Efficient MongoDB queries with proper indexing

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (recommended)
- MongoDB 6+ or MongoDB Atlas account
- npm or yarn package manager

### Installation

1. **Clone and navigate to backend directory:**

```bash
cd fry-dt-backend
```

2. **Install dependencies:**

```bash
npm install
```

3. **Environment setup:**

```bash
cp .env.example .env
```

4. **Configure environment variables:**

```env
# Database
DATABASE_URL=mongodb://localhost:27017/fry-diagnosis-tool
# Or for MongoDB Atlas:
# DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/fry-diagnosis-tool

# Authentication
SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRATION=24h

# Server Configuration
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:3001

# Optional: Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
```

5. **Start the development server:**

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 📊 API Documentation

### Authentication Endpoints

#### `POST /api/auth/signup`

Create a new teacher account.

```json
{
  "email": "teacher@school.edu",
  "password": "securepassword",
  "name": "Jane Teacher",
  "role": "teacher",
  "grade": "3"
}
```

#### `POST /api/auth/login`

Authenticate user (teacher or student).

```json
{
  "name": "Jane Teacher",
  "pw": "securepassword"
}
```

#### `POST /api/auth/addStudent`

Add a student to the system (teacher only).

```json
{
  "name": "Student Name",
  "email": "parent@email.com",
  "grade": "2",
  "avatar": "😊"
}
```

### Profile Management

#### `GET /api/profiles`

Get all profiles (teachers see all, students see own).

#### `GET /api/profiles/:id`

Get specific profile by ID.

#### `PUT /api/profiles/:id`

Update profile information.

#### `POST /api/profiles/:id/practicedWords`

Add practiced word data.

```json
{
  "word": "example",
  "mastered": false,
  "timesPracticed": 1,
  "timesCorrect": 1,
  "timesIncorrect": 0,
  "speechRecognitionScore": 85,
  "responseTime": 1200
}
```

### Assessment System

#### `POST /api/profiles/:id/assessments`

Submit assessment results.

```json
{
  "testType": "recognition",
  "words": ["the", "and", "for"],
  "responses": [
    {
      "word": "the",
      "correct": true,
      "timeSpent": 1000,
      "attempts": 1
    }
  ],
  "score": 85,
  "duration": 30000,
  "teacherNotes": "Great progress on sight words"
}
```

#### `GET /api/profiles/:id/assessments`

Retrieve assessment history with optional filtering:

- `?testType=recognition`
- `?word=example`
- `?sessionId=session123`

#### `GET /api/profiles/:id/progress`

Get comprehensive student progress analytics.

### Test Sessions

#### `POST /api/profiles/:id/testSessions`

Create new test session.

```json
{
  "sessionType": "assessment",
  "wordsUsed": ["the", "and", "for"],
  "sessionSettings": {
    "timeLimit": 300,
    "wordCount": 20,
    "testTypes": ["recognition"]
  },
  "results": {
    "totalWords": 20,
    "correctWords": 17,
    "averageResponseTime": 1500,
    "averageConfidence": 0.85
  }
}
```

### Speech Recognition Monitoring

#### `GET /api/profiles/:id/speech-sessions`

Get active speech recognition sessions for real-time teacher monitoring.

### Performance & Analytics

#### `GET /api/performance/metrics`

Get system performance metrics.

#### `GET /api/database/health`

Check database connection status.

#### `POST /api/ux/test/full`

Run comprehensive UX testing suite.

## 🏗️ Architecture

### Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO
- **Authentication**: JWT with bcrypt
- **Validation**: Custom middleware with comprehensive error handling
- **Monitoring**: Built-in performance tracking
- **Testing**: Jest with supertest for integration testing

### Project Structure

```
fry-dt-backend/
├── controllers/          # Request handlers
│   ├── auth.js          # Authentication logic
│   └── profiles.js      # Profile and assessment management
├── middleware/          # Custom middleware
│   ├── auth.js         # JWT authentication
│   ├── validation.js   # Input validation
│   ├── errorHandler.js # Error handling
│   └── performanceMonitor.js # Performance tracking
├── models/             # MongoDB schemas
│   ├── user.js        # User model
│   └── profile.js     # Profile with assessments
├── routes/            # API route definitions
│   ├── auth.js       # Authentication routes
│   ├── profiles.js   # Profile management routes
│   ├── performance.js # Performance monitoring
│   ├── database.js   # Database utilities
│   └── ux.js        # UX testing endpoints
├── socket/           # Socket.IO implementation
│   ├── socketServer.js # Main socket server
│   └── handlers/      # Event handlers
├── services/         # Business logic services
├── config/          # Configuration files
├── __tests__/       # Test suites
└── bin/            # Server startup scripts
```

### Database Schema

#### Profile Model

```javascript
{
  name: String,
  email: String,
  role: "teacher" | "student",
  grade: Number,
  currentLevel: Number,
  fryGradelevel: Number,
  avatar: String,
  voice: Object,        // Speech synthesis settings
  students: [ObjectId], // For teachers
  practicedWords: [{
    word: String,
    mastered: Boolean,
    timesPracticed: Number,
    speechRecognitionScore: Number,
    responseTime: Number,
    lastPracticed: Date
  }],
  assessments: [{
    testType: String,
    words: [String],
    responses: [{
      word: String,
      correct: Boolean,
      timeSpent: Number,
      attempts: Number
    }],
    score: Number,
    duration: Number,
    date: Date
  }],
  testSessions: [{
    sessionType: String,
    wordsUsed: [String],
    sessionSettings: Object,
    results: Object,
    date: Date
  }]
}
```

## 🔌 Socket.IO Events

### Teacher Events

- `join_room` - Join testing room
- `start_test_session` - Begin new test
- `send_word` - Send word to students
- `pronunciation_request` - Handle pronunciation requests

### Student Events

- `join_room` - Join testing room
- `student_test_response` - Submit test response
- `request_pronunciation` - Request word pronunciation

### Monitoring Events

- `speech_session_start` - Begin speech monitoring
- `speech_session_update` - Real-time progress updates
- `speech_session_end` - End monitoring session

## 🚀 Deployment

### Docker Deployment

1. **Build the image:**

```bash
docker build -t fry-backend .
```

2. **Run with Docker Compose:**

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Production Configuration

```yaml
# docker-compose.prod.yml
services:
  backend:
    build:
      context: ./fry-dt-backend
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

### Environment Variables (Production)

```env
NODE_ENV=production
DATABASE_URL=mongodb+srv://prod-user:password@cluster.mongodb.net/fry-prod
SECRET=your-ultra-secure-production-secret
CLIENT_URL=https://yourdomain.com
PERFORMANCE_MONITORING_ENABLED=true
```

## 🧪 Testing

### Run Tests

```bash
# Unit and integration tests
npm test

# Coverage report
npm run test:coverage

# End-to-end monitoring test
npm run test:monitoring

# Security audit
npm run security:audit
```

### Test Coverage

- Authentication flows
- API endpoint validation
- Database operations
- Socket.IO communication
- Speech recognition integration
- Error handling scenarios

## 📈 Performance Features

### Built-in Monitoring

- Request/response time tracking
- Memory usage monitoring
- Database query performance
- Error rate tracking
- Real-time metrics API

### Optimization Features

- Connection pooling
- Query optimization
- Caching strategies
- Gzip compression
- Rate limiting
- Input validation

## 🔒 Security

### Authentication & Authorization

- JWT tokens with expiration
- bcrypt password hashing
- Role-based access control
- Input validation and sanitization
- CORS configuration
- Rate limiting

### Best Practices

- Environment variable security
- SQL injection prevention
- XSS protection
- Helmet.js security headers
- Request size limits
- Error message sanitization

## 🤝 API Integration

### Frontend Integration

Connect your React frontend:

```javascript
const API_BASE = 'http://localhost:3000/api'

// Authentication
const login = async (credentials) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  })
  return response.json()
}

// Authenticated requests
const getProfiles = async (token) => {
  const response = await fetch(`${API_BASE}/profiles`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return response.json()
}
```

### Socket.IO Integration

```javascript
import io from 'socket.io-client'

const socket = io('http://localhost:3000')

// Join testing room
socket.emit('join_room', {
  username: user.name,
  room: roomCode,
  user: user
})

// Listen for test events
socket.on('test_word_received', (data) => {
  console.log('New word:', data.word)
})
```

## 📚 Additional Resources

### Scripts

- `npm start` - Production server
- `npm run dev` - Development with nodemon
- `npm run monitoring:start` - Start with performance monitoring
- `npm run build:optimize` - Production optimization
- `npm run production` - Production mode

### Health Checks

- `GET /health` - Basic health check
- `GET /api/database/health` - Database connection status
- `GET /api/performance/metrics` - Performance metrics

### Documentation Links

- [MongoDB Schema Design](./docs/schema.md)
- [Socket.IO Events](./docs/socket-events.md)
- [API Testing Guide](./docs/testing.md)
- [Deployment Guide](./docs/deployment.md)

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors:**

```bash
# Check MongoDB status
mongosh --eval "db.adminCommand('ping')"

# Verify connection string
echo $DATABASE_URL
```

**Authentication Issues:**

```bash
# Check JWT secret
echo $SECRET

# Verify token format in requests
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/profiles
```

**Socket.IO Connection Problems:**

```bash
# Test socket endpoint
curl http://localhost:3000/socket.io/

# Check CORS configuration
```

### Support

For issues and questions:

1. Check the [API documentation](#-api-documentation)
2. Review [test examples](./__tests__/)
3. Run health checks: `GET /health`
4. Check logs for detailed error messages

---

**Built with ❤️ for educational excellence**
