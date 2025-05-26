// Debug database state for user authentication
import mongoose from 'mongoose'
import 'dotenv/config.js'

const MONGO_URI = process.env.MONGO_DB

async function debugDatabase() {
  console.log('🔍 Debugging database state...\n')

  try {
    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected to MongoDB\n')

    const User = mongoose.model(
      'User',
      new mongoose.Schema(
        {
          name: String,
          email: String,
          password: String,
          role: String,
          profile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }
        },
        { timestamps: true }
      )
    )

    const Profile = mongoose.model(
      'Profile',
      new mongoose.Schema(
        {
          name: String,
          email: String,
          role: String,
          grade: Number,
          avatar: String
        },
        { timestamps: true }
      )
    )

    // Find all users
    console.log('👥 All Users in database:')
    const users = await User.find({}).select('name email role createdAt')
    users.forEach((user) => {
      console.log(
        `  - ${user.name} (${user.email}) - Role: ${user.role} - Created: ${user.createdAt}`
      )
    })

    console.log('\n📋 All Profiles in database:')
    const profiles = await Profile.find({}).select(
      'name email role grade avatar createdAt'
    )
    profiles.forEach((profile) => {
      console.log(
        `  - ${profile.name} (${profile.email}) - Role: ${profile.role} - Grade: ${profile.grade} - Avatar: ${profile.avatar} - Created: ${profile.createdAt}`
      )
    })

    // Test specific user lookups
    console.log('\n🔍 Testing user lookups:')

    const teacherUser = await User.findOne({ name: 'Test Teacher' })
    console.log(
      `Teacher User found: ${!!teacherUser} - ${
        teacherUser ? `${teacherUser.name} (${teacherUser.email})` : 'Not found'
      }`
    )

    const studentUser = await User.findOne({ name: 'Test Student' })
    console.log(
      `Student User found: ${!!studentUser} - ${
        studentUser ? `${studentUser.name} (${studentUser.email})` : 'Not found'
      }`
    )

    // Check if users have passwords
    if (teacherUser) {
      console.log(`Teacher has password: ${!!teacherUser.password}`)
    }
    if (studentUser) {
      console.log(`Student has password: ${!!studentUser.password}`)
    }

    console.log('\n📊 Summary:')
    console.log(`Total Users: ${users.length}`)
    console.log(`Total Profiles: ${profiles.length}`)
  } catch (error) {
    console.error('❌ Database error:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n✅ Disconnected from MongoDB')
  }
}

debugDatabase().catch(console.error)
