import jwt from 'jsonwebtoken'

const unauthorized = (res, message) => res.status(401).json({ err: message })

/**
 * Reads a Bearer token from the Authorization header only.
 * Tokens in query strings or bodies leak into logs and browser history,
 * so they are no longer accepted.
 */
export function getBearerToken(req) {
  const header = req.get('Authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export function verifyToken(token) {
  const secret = process.env.SECRET
  if (!secret) {
    throw Object.assign(new Error('Server configuration error'), {
      status: 500
    })
  }
  return jwt.verify(token, secret)
}

const decodeUserFromToken = (req, res, next) => {
  const token = getBearerToken(req)
  if (!token) return next()

  try {
    const decoded = verifyToken(token)
    req.user = decoded.user
    next()
  } catch (err) {
    if (err.status === 500) {
      return res.status(500).json({ err: err.message })
    }
    return unauthorized(
      res,
      err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
    )
  }
}

function checkAuth(req, res, next) {
  return req.user ? next() : unauthorized(res, 'Not Authorized')
}

function passUserToView(req, res, next) {
  res.locals.user = req.user ? req.user : null
  next()
}

/**
 * Builds the JWT for a user. Only non-sensitive identifiers go in the token;
 * permissions (isAdmin, which students a teacher has) are always re-read
 * from the database on each request.
 */
function createJWT(user) {
  const payload = {
    user: {
      _id: String(user._id),
      name: user.name,
      role: user.role,
      profile: user.profile ? String(user.profile._id || user.profile) : null
    }
  }
  return jwt.sign(payload, process.env.SECRET, {
    expiresIn: process.env.JWT_EXPIRATION || '12h'
  })
}

export { decodeUserFromToken, checkAuth, passUserToView, createJWT }
