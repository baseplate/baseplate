const jwt = require('jsonwebtoken')

const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

module.exports = req => {
  const authorizationHeader = req && req.headers && req.headers.Authorization

  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return null
  }

  const match = authorizationHeader.match(/^Bearer (.*)$/)

  if (!match) {
    return null
  }

  const accessToken = match[1]

  try {
    const payload = jwt.verify(accessToken, TOKEN_PRIVATE_KEY)

    return payload.data
  } catch {
    return null
  }
}
