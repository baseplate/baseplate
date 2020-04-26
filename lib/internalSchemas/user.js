const bcrypt = require('bcrypt')

const Model = require('../model')
const QueryFilter = require('../queryFilter')
const Schema = require('../schema')

class UserModel extends Model {
  static getSchema() {
    return new Schema({
      fields: {
        _createdAt: Number,
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
      },
      name: '_user'
    })
  }

  async getAccessForResource({accessType, resourceName}) {
    if (this.get('accessLevel') === 'admin') {
      return true
    }

    await this.constructor.initialize()

    const access = await this._datastore.getUserAccessForResource({
      accessType,
      modelName: this.constructor.name,
      resourceName,
      userId: this.id
    })

    return this.normalizeAccessValue(access)
  }

  isAdmin() {
    return this.get('accessLevel') === 'admin'
  }

  normalizeAccessValue(value) {
    if (!value) {
      return false
    }

    if (typeof value === 'boolean') {
      return value
    }

    const normalizedValue = {}

    if (value.fields) {
      normalizedValue.fields = value.fields.filter(
        fieldName => typeof fieldName === 'string'
      )
    }

    if (value.filter) {
      normalizedValue.filter = QueryFilter.parse(value.filter, '_')
    }

    return Object.keys(normalizedValue).length > 0 ? normalizedValue : false
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
