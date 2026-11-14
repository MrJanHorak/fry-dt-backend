import mongoose from 'mongoose'
import { DatabaseOptimizer } from './database-optimizer.js'

const db = mongoose.connection
let dbOptimizer = null

mongoose.set('strictQuery', false)

if (process.env.SKIP_DB_CONNECTION === 'true') {
  // Tests run without a database
} else if (!process.env.MONGO_DB) {
  console.error('MONGO_DB is not set; cannot connect to MongoDB')
} else {
  mongoose.connect(process.env.MONGO_DB)
}

db.on('connected', async function () {
  console.log(`Connected to MongoDB ${db.name} at ${db.host}:${db.port}`)

  // Initialize database optimization in production
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.ENABLE_DB_OPTIMIZATION === 'true'
  ) {
    try {
      dbOptimizer = new DatabaseOptimizer()
      await dbOptimizer.initialize()
    } catch (error) {
      console.error('Database optimization initialization failed:', error)
    }
  }
})

db.on('error', function (err) {
  console.error('MongoDB connection error:', err)
})

db.on('disconnected', function () {
  console.log('MongoDB disconnected')
})

// Export database optimizer for API routes
export { dbOptimizer }
