const {ForbiddenError, UnauthorizedError} = require('../errors')
const ModelStore = require('../modelStore')
const QueryFilter = require('../queryFilter')

//const modelStore = new ModelStore()

class AccessValidator {
  static normalize(value) {
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

  static async validate({accessLevel, accessType, id, modelName, resource}) {
    if (accessLevel === 'admin') {
      return true
    }

    if (!accessType || !id || !modelName) {
      throw new UnauthorizedError()
    }

    const Model = modelStore.get(modelName)

    if (!Model) {
      throw new UnauthorizedError()
    }

    const user = await Model.findOneById({
      id
    })

    if (!user) {
      throw new UnauthorizedError()
    }

    const userPermissions = user.get('_permissions') || {}
    const resourcePermissions = userPermissions[resource] || {}
    const typePermissions = resourcePermissions[accessType]
    const access = AccessValidator.normalize(typePermissions)

    if (!access) {
      throw new ForbiddenError()
    }

    return access
  }
}

module.exports = AccessValidator.validate
