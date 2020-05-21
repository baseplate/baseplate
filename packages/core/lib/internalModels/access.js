const {EntryNotFoundError, ModelNotFoundError} = require('../errors')
const JsonApiRequest = require('../specs/jsonApi/request')
const JsonApiResponse = require('../specs/jsonApi/response')
const AccessValue = require('../accessValue')
const Model = require('../model')
const QueryFilter = require('../queryFilter')

class AccessController {
  static async createModelAccessEntry(req, res) {
    try {
      const Model = this.store.get(req.params.modelName, {
        context: this.context
      })

      if (!Model) {
        throw new ModelNotFoundError({name: req.params.modelName})
      }

      const jsonApiReq = new JsonApiRequest(req, this.context)
      const modelAccess = await this.create({
        entryFields: {
          ...jsonApiReq.bodyFields,
          model: req.params.modelName
        }
      })

      modelAccess.id = this.encodeModelAccessKey(modelAccess.get('user'))

      const {body, statusCode} = await JsonApiResponse.toObject({
        entries: modelAccess,
        statusCode: 201,
        url: req.url
      })

      res.status(statusCode).json(body)
    } catch (errors) {
      const {body, statusCode} = await JsonApiResponse.toObject({
        errors,
        url: req.url
      })

      res.status(statusCode).json(body)
    }
  }

  static async findModelAccessEntries(req, res) {
    try {
      const Model = this.store.get(req.params.modelName, {
        context: this.context
      })

      if (!Model) {
        throw new ModelNotFoundError({name: req.params.modelName})
      }

      const entries = await this.getAccessEntries({
        modelName: req.params.modelName
      })
      const jsonApiReq = new JsonApiRequest(req, this.context)
      const references = await jsonApiReq.resolveReferences({entries, Model})
      const {body, statusCode} = await JsonApiResponse.toObject({
        entries,
        includedReferences: Object.values(references),
        url: req.url
      })

      res.status(statusCode).json(body)
    } catch (errors) {
      const {body, statusCode} = await JsonApiResponse.toObject({
        errors,
        url: req.url
      })

      res.status(statusCode).json(body)
    }
  }

  static async findModelAccessEntry(req, res) {
    try {
      const Model = this.store.get(req.params.modelName, {
        context: this.context
      })

      if (!Model) {
        throw new ModelNotFoundError({name: req.params.modelName})
      }

      const userData = this.decodeModelAccessKey(req.params.id)

      if (userData === undefined) {
        throw new EntryNotFoundError({id: req.params.id})
      }

      let user = null

      if (userData !== null) {
        const UserModel = this.store.get(userData.modelName, {
          context: this.context
        })

        if (!UserModel) {
          throw new EntryNotFoundError({id: req.params.id})
        }

        user = new UserModel({_id: userData.id})
      }

      const entries = await this.getAccessEntries({
        modelName: req.params.modelName,
        user
      })

      if (entries.length === 0) {
        throw new EntryNotFoundError({id: req.params.id})
      }

      const jsonApiReq = new JsonApiRequest(req, this.context)
      const references = await jsonApiReq.resolveReferences({entries, Model})
      const {body, statusCode} = await JsonApiResponse.toObject({
        entries: entries[0],
        includedReferences: Object.values(references),
        url: req.url
      })

      res.status(statusCode).json(body)
    } catch (errors) {
      const {body, statusCode} = await JsonApiResponse.toObject({
        errors,
        url: req.url
      })

      res.status(statusCode).json(body)
    }
  }

  static async updateModelAccessEntry(req, res) {
    try {
      const Model = this.store.get(req.params.modelName, {
        context: this.context
      })

      if (!Model) {
        throw new ModelNotFoundError({name: req.params.modelName})
      }

      const userData = this.decodeModelAccessKey(req.params.id)

      if (userData === undefined) {
        throw new EntryNotFoundError({id: req.params.id})
      }

      let user = null

      if (userData !== null) {
        const UserModel = this.store.get(userData.modelName, {
          context: this.context
        })

        if (!UserModel) {
          throw new EntryNotFoundError({id: req.params.id})
        }

        user = new UserModel({_id: userData.id})
      }

      const jsonApiReq = new JsonApiRequest(req, this.context)
      const [modelAccess] = await this.updateAccessEntry({
        modelName: req.params.modelName,
        update: jsonApiReq.bodyFields,
        user
      })

      modelAccess.id = this.encodeModelAccessKey(modelAccess.get('user'))

      const references = await jsonApiReq.resolveReferences({
        entries: [modelAccess],
        Model
      })
      const {body, statusCode} = await JsonApiResponse.toObject({
        entries: modelAccess,
        includedReferences: Object.values(references),
        url: req.url
      })

      res.status(statusCode).json(body)
    } catch (errors) {
      const {body, statusCode} = await JsonApiResponse.toObject({
        errors,
        url: req.url
      })

      res.status(statusCode).json(body)
    }
  }
}

class base_access extends Model {
  static decodeModelAccessKey(key) {
    if (key === 'public') {
      return null
    }

    const separatorIndex = key.lastIndexOf('_')

    if (separatorIndex > -1) {
      return {
        id: key.slice(separatorIndex + 1),
        modelName: key.slice(0, separatorIndex)
      }
    }
  }

  static encodeModelAccessKey(user) {
    if (!user) {
      return 'public'
    }

    return `${user._type}_${user._id}`
  }

  static async getAccess({
    accessType,
    includePublicUser = true,
    modelName,
    user
  }) {
    if (user && user.isAdmin()) {
      return AccessValue.parse(true)
    }

    const entries = await this.getAccessEntries({
      includePublicUser,
      modelName,
      user
    })

    if (entries.length === 0) {
      return AccessValue.parse(false)
    }

    const value = entries.reduce((value, entry) => {
      const valueForType = AccessValue.parse(entry.get(accessType))

      return AccessValue.unite(value, valueForType)
    }, AccessValue.parse(false))

    return value
  }

  static async getAccessEntries({includePublicUser, modelName, user}) {
    let filter

    if (user) {
      const userFilter = QueryFilter.parse({
        'user._id': user.id,
        'user._type': user.constructor.name
      })

      filter = filter ? filter.uniteWith(userFilter) : userFilter
    }

    if (includePublicUser) {
      const publicUserFilter = QueryFilter.parse({user: null})

      filter = filter ? filter.uniteWith(publicUserFilter) : publicUserFilter
    }

    const {results} = await this.datastore.find({
      filter,
      modelName: this.name
    })
    const entries = results
      .filter(result => result.model === modelName)
      .map(result => {
        const id = this.encodeModelAccessKey(result.user)

        return new this({...result, _id: id})
      })

    return entries
  }

  static async updateAccessEntry({modelName, update, user}) {
    const filter = QueryFilter.parse({model: modelName})

    if (user) {
      const userQuery = {
        'user._id': user.id,
        'user._type': user.constructor.name
      }

      filter.intersectWith(QueryFilter.parse(userQuery))
    } else {
      const publicUserQuery = QueryFilter.parse({user: null})

      filter.intersectWith(publicUserQuery)
    }

    const {results} = await this.datastore.update({
      filter,
      modelName: 'base_access',
      update
    })

    return results.map(result => {
      const id = this.encodeModelAccessKey(result.user)

      return new this({...result, _id: id})
    })
  }
}

base_access.customRoutes = {
  '/base_models/:modelName/access': {
    get: AccessController.findModelAccessEntries,
    post: AccessController.createModelAccessEntry
  },
  '/base_models/:modelName/access/:id': {
    get: AccessController.findModelAccessEntry,
    patch: AccessController.updateModelAccessEntry
  }
}

const accessValueProps = {
  type: 'Mixed',
  default: false,
  get: value => {
    return AccessValue.parse(value, {filterPrefix: '_'}).toObject({
      filterPrefix: '$'
    })
  },
  set: value => {
    return AccessValue.parse(value, {filterPrefix: '$'}).toObject({
      filterPrefix: '_'
    })
  }
}

base_access.fields = {
  user: 'base_user',
  model: {
    type: String,
    get: () => {}
  },
  create: {
    ...accessValueProps
  },
  read: {
    ...accessValueProps
  },
  update: {
    ...accessValueProps
  },
  delete: {
    ...accessValueProps
  }
}

module.exports = base_access