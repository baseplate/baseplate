const jwt = require('jsonwebtoken')

const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

module.exports = authorizationHeader => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return
  }

  const match = authorizationHeader.match(/^Bearer (.*)$/)

  if (!match) {
    return
  }

  const accessToken = match[1]

  try {
    const payload = jwt.verify(accessToken, TOKEN_PRIVATE_KEY)

    return payload.data
  } catch {
    return
  }
}
