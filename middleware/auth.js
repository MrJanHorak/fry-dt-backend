import jwt from 'jsonwebtoken'

const SECRET = process.env.SECRET

const decodeUserFromToken = (req, res, next) => {
  let token = req.get('Authorization') || req.query.token || req.body.token
  if (token) {
    token = token.replace('Bearer ', '')
    console.log('Token received:', token.substring(0, 20) + '...')
    console.log('SECRET available:', !!SECRET)
    jwt.verify(token, SECRET, (err, decoded) => {
      if (err) {
        console.log('JWT verification error:', err.message)
        return res.status(401).json({ msg: 'Invalid token' })
      } else {
        req.user = decoded.user
        console.log('User decoded successfully:', req.user._id)
        next()
      }
    })
  } else {
    console.log('No token provided')
    next()
  }
}

function checkAuth(req, res, next) {
  return req.user ? next() : res.status(401).json({ msg: 'Not Authorized' })
}

function passUserToView(req, res, next) {
  res.locals.user = req.user ? req.user : null
  next()
}

export { decodeUserFromToken, checkAuth, passUserToView }
