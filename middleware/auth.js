import jwt from 'jsonwebtoken'

const unauthorized = (res, message) => res.status(401).json({ err: message })

const decodeUserFromToken = (req, res, next) => {
  let token = req.get('Authorization') || req.query.token || req.body.token
  if (token) {
    token = token.replace('Bearer ', '')
    const secret = process.env.SECRET

    if (!secret) {
      return res.status(500).json({ err: 'Server configuration error' })
    }

    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        return unauthorized(
          res,
          err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
        )
      } else {
        req.user = decoded.user
        next()
      }
    })
  } else {
    next()
  }
}

function checkAuth(req, res, next) {
  return req.user ? next() : unauthorized(res, 'Not Authorized')
}

function passUserToView(req, res, next) {
  res.locals.user = req.user ? req.user : null
  next()
}

export { decodeUserFromToken, checkAuth, passUserToView }
