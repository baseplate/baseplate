const jwt = require('jsonwebtoken')

const {default: Model} = require('../model')
const {QueryFilter} = require('../queryFilter')

const TOKEN_EXPIRATION = 360000
const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

class BaseRefreshToken extends Model {
  static decode(token) {
    return jwt.verify(token, TOKEN_PRIVATE_KEY)
  }

  static generate(user) {
    const data = {
      id: user.id,
      modelName: user.constructor.handle,
    }
    const token = jwt.sign(
      {
        ttl: TOKEN_EXPIRATION,
        data,
      },
      TOKEN_PRIVATE_KEY
    )

    return {
      token,
      ttl: TOKEN_EXPIRATION,
    }
  }

  static async generateAndCreate(user) {
    const {token, ttl} = this.generate(user)

    await this.create({token})

    return {
      token,
      ttl,
    }
  }

  static async generateAndReplace(user, oldToken) {
    const {token, ttl} = this.generate(user)
    const updatedEntries = await this.update({
      filter: QueryFilter.parse({token: oldToken}),
      update: {token},
    })

    return {
      didReplace: updatedEntries.length > 0,
      token,
      ttl,
    }
  }
}

BaseRefreshToken.fields = {
  token: String,
}

BaseRefreshToken.handle = 'base_refreshToken'

module.exports = BaseRefreshToken
