const bcrypt = require('bcrypt')

const Model = require('../model')

class UserModel extends Model {
  static getRoutes() {
    return {
      '/token': {
        post(_, res) {
          res.status(200).json({oh: 'YEAH!'})
        }
      }
    }
  }

  static getSchema() {
    return {
      fields: {
        _createdAt: Number,
        _permissions: 'Mixed',
        accessLevel: {
          type: String,
          default: 'user',
          enum: ['admin', 'user']
        },
        username: {
          type: String,
          required: true
        },
        password: {
          type: String,
          required: true,
          set: value =>
            new Promise((resolve, reject) => {
              bcrypt.hash(value, 10, (err, hash) =>
                err ? reject(err) : resolve(hash)
              )
            })
        }
      }
    }
  }

  async toObject(options) {
    const object = await super.toObject(options)

    delete object.password

    return object
  }

  validatePassword(password) {
    return bcrypt.compare(password, this.get('password'))
  }
}

module.exports = UserModel
