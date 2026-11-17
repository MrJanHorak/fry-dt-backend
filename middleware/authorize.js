/**
 * Authorization helpers.
 *
 * Authentication (middleware/auth.js) answers "who is this?".
 * These helpers answer "may they touch this student's record?".
 *
 * Rules:
 *  - Everyone may access their own profile.
 *  - A teacher or parent may access profiles listed in their `students` array.
 *  - An admin (isAdmin read fresh from the database, never from the token)
 *    may access everything.
 */

import mongoose from 'mongoose'
import { Profile } from '../models/profile.js'

const forbidden = (res, message = 'You do not have access to this record') =>
  res.status(403).json({ err: message })

const toIdString = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value._id) return String(value._id)
  return String(value)
}

/**
 * Loads the requester's own profile (role, students, isAdmin) once per request
 * and caches it on req.requester.
 */
export async function loadRequester(req) {
  if (req.requester) return req.requester

  const profileId = toIdString(req.user?.profile)
  if (!profileId || !mongoose.isValidObjectId(profileId)) return null

  const profile = await Profile.findById(profileId)
    .select('_id role students isAdmin name')
    .lean()

  if (!profile) return null

  req.requester = {
    profileId: String(profile._id),
    role: profile.role,
    name: profile.name,
    isAdmin: Boolean(profile.isAdmin),
    studentIds: new Set((profile.students || []).map(toIdString))
  }

  return req.requester
}

export function canAccessProfile(requester, targetProfileId) {
  if (!requester || !targetProfileId) return false
  const target = toIdString(targetProfileId)
  return (
    requester.isAdmin ||
    requester.profileId === target ||
    requester.studentIds.has(target)
  )
}

export function isEducatorOf(requester, targetProfileId) {
  if (!requester || !targetProfileId) return false
  if (requester.isAdmin) return true
  return (
    ['teacher', 'parent'].includes(requester.role) &&
    requester.studentIds.has(toIdString(targetProfileId))
  )
}

/** Route guard: requester must own, teach/parent, or administer :param. */
export const requireProfileAccess =
  (param = 'id') =>
  async (req, res, next) => {
    try {
      const requester = await loadRequester(req)
      if (!canAccessProfile(requester, req.params[param])) {
        return forbidden(res)
      }
      next()
    } catch (err) {
      next(err)
    }
  }

/** Route guard: requester must be a teacher/parent of :param (or admin). */
export const requireEducatorOf =
  (param = 'studentId') =>
  async (req, res, next) => {
    try {
      const requester = await loadRequester(req)
      if (!isEducatorOf(requester, req.params[param])) {
        return forbidden(res, 'Only this student’s teacher can do that')
      }
      next()
    } catch (err) {
      next(err)
    }
  }

/** Route guard: requester must have one of the given roles (admins pass). */
export const requireRole =
  (...roles) =>
  async (req, res, next) => {
    try {
      const requester = await loadRequester(req)
      if (!requester || !(requester.isAdmin || roles.includes(requester.role))) {
        return forbidden(res, 'Your account type cannot do that')
      }
      next()
    } catch (err) {
      next(err)
    }
  }

/** Route guard: admin only. */
export async function requireAdmin(req, res, next) {
  try {
    const requester = await loadRequester(req)
    if (!requester?.isAdmin) {
      return forbidden(res, 'Admin access required')
    }
    next()
  } catch (err) {
    next(err)
  }
}

/** Copies only allowed keys from a request body. */
export function pick(source = {}, allowedKeys = []) {
  return allowedKeys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      acc[key] = source[key]
    }
    return acc
  }, {})
}
