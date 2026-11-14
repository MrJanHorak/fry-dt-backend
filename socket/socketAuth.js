/**
 * Socket.IO authentication.
 *
 * Every socket must present the same JWT the REST API uses
 * (`io(url, { auth: { token } })`). The verified identity is stored on
 * `socket.data.identity`; handlers must use it instead of any user/role/id
 * values sent by the client.
 */

import mongoose from 'mongoose'
import { verifyToken } from '../middleware/auth.js'
import { Profile } from '../models/profile.js'

const toId = (value) => (value ? String(value._id || value) : null)

export async function loadIdentity(decodedUser) {
  const profileId = toId(decodedUser?.profile)
  if (!profileId || !mongoose.isValidObjectId(profileId)) return null

  const [profile, guardians] = await Promise.all([
    Profile.findById(profileId)
      .select('_id name role students isAdmin avatar')
      .lean(),
    // Teachers/parents who have this person on their roster
    Profile.find({ students: profileId }).select('_id').lean()
  ])

  if (!profile) return null

  return {
    userId: toId(decodedUser._id),
    profileId: String(profile._id),
    name: profile.name,
    role: profile.role,
    avatar: profile.avatar,
    isAdmin: Boolean(profile.isAdmin),
    studentIds: new Set((profile.students || []).map(toId)),
    guardianIds: guardians.map((g) => String(g._id))
  }
}

export function socketAuthMiddleware() {
  return async (socket, next) => {
    try {
      const header = socket.handshake.headers?.authorization || ''
      const token =
        socket.handshake.auth?.token ||
        (header.startsWith('Bearer ') ? header.slice(7) : null)

      if (!token) return next(new Error('unauthorized'))

      const decoded = verifyToken(token)
      const identity = await loadIdentity(decoded.user)
      if (!identity) return next(new Error('unauthorized'))

      socket.data.identity = identity
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  }
}

/** Serializable public view of an identity (safe to send to other clients). */
export const publicUser = (identity) => ({
  _id: identity.userId,
  profile: identity.profileId,
  name: identity.name,
  role: identity.role,
  avatar: identity.avatar
})

export const isTeacherLike = (identity) =>
  Boolean(
    identity && (identity.isAdmin || ['teacher', 'parent'].includes(identity.role))
  )

export const teachesStudent = (identity, studentProfileId) =>
  Boolean(
    identity &&
      studentProfileId &&
      (identity.isAdmin || identity.studentIds.has(String(studentProfileId)))
  )

export const profileRoom = (profileId) => `profile:${profileId}`
