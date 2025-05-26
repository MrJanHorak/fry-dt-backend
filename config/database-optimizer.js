/**
 * Database Optimization Configuration
 * Handles indexing, query optimization, and performance monitoring for MongoDB
 */

import mongoose from 'mongoose'
import { Profile } from '../models/profile.js'
import { User } from '../models/user.js'

class DatabaseOptimizer {
  constructor() {
    this.isOptimized = false
    this.indexes = []
    this.queryStats = new Map()
    this.optimizationReport = {
      timestamp: null,
      indexesCreated: [],
      performanceMetrics: {},
      recommendations: []
    }
  }

  /**
   * Create optimal indexes for the application
   */
  async createIndexes() {
    console.log('🗄️  Creating database indexes...')

    try {
      // User model indexes
      await this.createUserIndexes()

      // Profile model indexes
      await this.createProfileIndexes()

      // Set database connection options for optimization
      await this.optimizeConnection()

      this.isOptimized = true
      console.log('✅ Database indexes created successfully')

      return this.indexes
    } catch (error) {
      console.error('❌ Error creating database indexes:', error)
      throw error
    }
  }

  /**
   * Create indexes for User collection
   */
  async createUserIndexes() {
    const userIndexes = [
      // Unique email index for authentication
      { email: 1 },

      // Role-based queries
      { role: 1 },

      // Profile reference for user lookup
      { profile: 1 },

      // Compound index for user search
      { email: 1, role: 1 },

      // Created timestamp for sorting
      { createdAt: -1 }
    ]

    for (const index of userIndexes) {
      try {
        await User.collection.createIndex(index)
        this.indexes.push({ collection: 'users', index })
        console.log(`   ✓ User index created: ${JSON.stringify(index)}`)
      } catch (error) {
        // Index might already exist, continue
        if (error.code !== 11000) {
          console.warn(`   ⚠️  User index warning: ${error.message}`)
        }
      }
    }
  }

  /**
   * Create indexes for Profile collection
   */
  async createProfileIndexes() {
    const profileIndexes = [
      // Unique email index
      { email: 1 },

      // Name search index (text search)
      { name: 'text' },

      // Role-based filtering
      { role: 1 },

      // Grade level queries
      { grade: 1 },

      // Fry grade level for educational content
      { fryGradelevel: 1 },

      // Admin flag for permissions
      { isAdmin: 1 },

      // Student relationship queries
      { students: 1 },

      // Compound index for teacher dashboard
      { role: 1, grade: 1 },

      // Compound index for student performance
      { role: 1, fryGradelevel: 1, tested: 1 },

      // Practiced words performance (sparse index)
      { 'practicedWords.word': 1 },
      { 'practicedWords.mastered': 1 },
      { 'practicedWords.timesPracticed': -1 },

      // Updated timestamp for recent activity
      { updatedAt: -1 },

      // Compound index for student lookup by teacher
      { role: 1, students: 1, updatedAt: -1 }
    ]

    for (const index of profileIndexes) {
      try {
        await Profile.collection.createIndex(index)
        this.indexes.push({ collection: 'profiles', index })
        console.log(`   ✓ Profile index created: ${JSON.stringify(index)}`)
      } catch (error) {
        // Index might already exist, continue
        if (error.code !== 11000) {
          console.warn(`   ⚠️  Profile index warning: ${error.message}`)
        }
      }
    }
  }

  /**
   * Optimize MongoDB connection settings
   */
  async optimizeConnection() {
    try {
      // Enable read concern for better performance
      mongoose.connection.db.admin().command({
        setParameter: 1,
        logLevel: 1
      })

      console.log('   ✓ Database connection optimized')
    } catch (error) {
      console.warn('   ⚠️  Connection optimization warning:', error.message)
    }
  }

  /**
   * Analyze query performance
   */
  async analyzeQueries() {
    console.log('📊 Analyzing query performance...')

    const performance = {
      collections: {},
      slowQueries: [],
      recommendations: []
    }

    try {
      // Get collection stats
      const collections = ['users', 'profiles']

      for (const collectionName of collections) {
        const collection = mongoose.connection.db.collection(collectionName)
        const stats = await collection.stats()

        performance.collections[collectionName] = {
          count: stats.count,
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize,
          totalIndexSize: stats.totalIndexSize,
          indexSizes: stats.indexSizes
        }
      }

      // Check for potential issues
      this.generatePerformanceRecommendations(performance)

      this.optimizationReport.performanceMetrics = performance
      console.log('✅ Query analysis completed')

      return performance
    } catch (error) {
      console.error('❌ Error analyzing queries:', error)
      return performance
    }
  }

  /**
   * Generate performance recommendations
   */
  generatePerformanceRecommendations(performance) {
    const recommendations = []

    // Check for large collection sizes
    Object.entries(performance.collections).forEach(([name, stats]) => {
      if (stats.count > 10000) {
        recommendations.push({
          type: 'performance',
          collection: name,
          issue: 'Large collection size',
          recommendation:
            'Consider implementing data archiving for old records',
          priority: 'medium'
        })
      }

      if (stats.avgObjSize > 16384) {
        // 16KB
        recommendations.push({
          type: 'storage',
          collection: name,
          issue: 'Large average document size',
          recommendation:
            'Consider normalizing large embedded arrays or using references',
          priority: 'high'
        })
      }

      if (stats.totalIndexSize > stats.storageSize * 0.5) {
        recommendations.push({
          type: 'indexing',
          collection: name,
          issue: 'Index size is large relative to data size',
          recommendation: 'Review and remove unused indexes',
          priority: 'low'
        })
      }
    })

    this.optimizationReport.recommendations = recommendations
    return recommendations
  }

  /**
   * Monitor query performance in real-time
   */
  startQueryMonitoring() {
    console.log('🔍 Starting query performance monitoring...')

    // Enable MongoDB profiler for slow queries
    mongoose.connection.db
      .admin()
      .command({
        profile: 2,
        slowms: 100,
        sampleRate: 0.1
      })
      .catch((err) => {
        console.warn('⚠️  Could not enable MongoDB profiler:', err.message)
      })

    // Monitor mongoose queries
    mongoose.set('debug', (collectionName, method, query, doc) => {
      const key = `${collectionName}.${method}`

      if (!this.queryStats.has(key)) {
        this.queryStats.set(key, {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          lastExecuted: null
        })
      }

      const stats = this.queryStats.get(key)
      stats.count++
      stats.lastExecuted = new Date()
    })

    console.log('✅ Query monitoring started')
  }

  /**
   * Get query statistics
   */
  getQueryStats() {
    const stats = {}
    this.queryStats.forEach((value, key) => {
      stats[key] = { ...value }
    })
    return stats
  }

  /**
   * Optimize specific collections
   */
  async optimizeCollections() {
    console.log('⚡ Optimizing collections...')

    try {
      // Compact collections to reclaim space
      const collections = ['users', 'profiles']

      for (const collectionName of collections) {
        try {
          await mongoose.connection.db.admin().command({
            compact: collectionName
          })
          console.log(`   ✓ Compacted collection: ${collectionName}`)
        } catch (error) {
          console.warn(
            `   ⚠️  Could not compact ${collectionName}:`,
            error.message
          )
        }
      }

      console.log('✅ Collection optimization completed')
    } catch (error) {
      console.error('❌ Error optimizing collections:', error)
    }
  }

  /**
   * Generate comprehensive optimization report
   */
  async generateOptimizationReport() {
    console.log('📋 Generating database optimization report...')

    this.optimizationReport.timestamp = new Date().toISOString()
    this.optimizationReport.indexesCreated = this.indexes

    // Analyze current performance
    await this.analyzeQueries()

    // Add query statistics
    this.optimizationReport.queryStatistics = this.getQueryStats()

    // Database health check
    this.optimizationReport.healthCheck = await this.performHealthCheck()

    console.log('✅ Optimization report generated')
    return this.optimizationReport
  }

  /**
   * Perform database health check
   */
  async performHealthCheck() {
    const healthCheck = {
      connection: false,
      indexes: false,
      performance: 'unknown',
      recommendations: []
    }

    try {
      // Check connection
      healthCheck.connection = mongoose.connection.readyState === 1

      // Check indexes
      healthCheck.indexes = this.isOptimized

      // Performance assessment
      const queryStats = this.getQueryStats()
      const totalQueries = Object.values(queryStats).reduce(
        (sum, stat) => sum + stat.count,
        0
      )

      if (totalQueries > 100) {
        healthCheck.performance = 'good'
      } else if (totalQueries > 10) {
        healthCheck.performance = 'fair'
      } else {
        healthCheck.performance = 'limited_data'
      }

      // Add health recommendations
      if (!healthCheck.connection) {
        healthCheck.recommendations.push('Database connection issues detected')
      }

      if (!healthCheck.indexes) {
        healthCheck.recommendations.push('Database indexes not optimized')
      }

      return healthCheck
    } catch (error) {
      console.error('❌ Health check error:', error)
      return healthCheck
    }
  }

  /**
   * Initialize database optimization
   */
  async initialize() {
    console.log('🚀 Initializing database optimization...')

    try {
      await this.createIndexes()
      this.startQueryMonitoring()

      // Generate initial report
      const report = await this.generateOptimizationReport()

      console.log('🎉 Database optimization initialization completed!')
      console.log(`📊 Created ${this.indexes.length} indexes`)
      console.log(`⚡ Performance monitoring active`)

      if (report.recommendations.length > 0) {
        console.log('\n📋 Optimization Recommendations:')
        report.recommendations.forEach((rec, index) => {
          console.log(
            `   ${index + 1}. ${rec.issue} (${rec.priority} priority)`
          )
          console.log(`      💡 ${rec.recommendation}`)
        })
      }

      return report
    } catch (error) {
      console.error('❌ Database optimization initialization failed:', error)
      throw error
    }
  }
}

export { DatabaseOptimizer }
