import jwt from 'jsonwebtoken'

import BaseModel from '../model/base'
import QueryFilter from '../queryFilter'
import User from './user'

const TOKEN_EXPIRATION = 360000
const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

export default class Base$RefreshToken extends BaseModel {
  static base$fields = {
    token: String,
  }

  static decode(token: string) {
    return jwt.verify(token, TOKEN_PRIVATE_KEY)
  }

  static async deleteToken(token: string) {
    const filter = QueryFilter.parse({token})
    const {deleteCount} = await super.delete({filter})

    return deleteCount > 0
  }

  static generate(user: User) {
    const data = {
      id: user.id,
      modelName: (<typeof User>user.constructor).base$handle,
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

  static async generateAndCreate(user: User) {
    const {token, ttl} = this.generate(user)

    await this.create({token}, {authenticate: false})

    return {
      token,
      ttl,
    }
  }

  static async generateAndReplace(user: User, oldToken: string) {
    const {token, ttl} = this.generate(user)
    const results = await this.update({
      authenticate: false,
      filter: QueryFilter.parse({token: oldToken}),
      update: {token},
    })

    return {
      didReplace: results.length > 0,
      token,
      ttl,
    }
  }
}
