const jwt = require('jsonwebtoken')

const TOKEN_EXPIRATION = 360000
const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

module.exports = ({user}) => {
  const data = {
    id: user.id,
    level: user.get('accessLevel'),
    model: user.constructor.name
  }
  const accessToken = jwt.sign(
    {
      expiresIn: TOKEN_EXPIRATION,
      data
    },
    TOKEN_PRIVATE_KEY
  )

  return {accessToken, expiration: TOKEN_EXPIRATION}
}
