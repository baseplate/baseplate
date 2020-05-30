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
        ...jsonApiReq.bodyFields,
        model: req.params.modelName
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
        context,
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

class BaseAccess extends Model {
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

    return `${user.type}_${user.id}`
  }

  static async getAccess({
    accessType,
    context,
    includePublicUser = true,
    modelName,
    user
  }) {
    if (user && user.isAdmin()) {
      return AccessValue.parse(true)
    }

    const entries = await this.getAccessEntries({
      context,
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

  static async getAccessEntries({context, includePublicUser, modelName, user}) {
    let filter

    if (user) {
      const userFilter = QueryFilter.parse({
        'user.id': user.id,
        'user.type': user.constructor.handle
      })

      filter = filter ? filter.uniteWith(userFilter) : userFilter
    }

    if (includePublicUser) {
      const publicUserFilter = QueryFilter.parse({user: null})

      filter = filter ? filter.uniteWith(publicUserFilter) : publicUserFilter
    }

    const {results} = await super.$__find({
      context,
      filter
    })
    const entries = results
      .filter(result => result.model === modelName)
      .map(result => {
        const id = this.encodeModelAccessKey(result.user)

        return new this({...result, _id: id})
      })

    return entries
  }

  static async updateAccessEntry({context, modelName, update, user}) {
    const filter = QueryFilter.parse({model: modelName})

    if (user) {
      const userQuery = {
        'user.id': user.id,
        'user.type': user.constructor.handle
      }

      filter.intersectWith(QueryFilter.parse(userQuery))
    } else {
      const publicUserQuery = QueryFilter.parse({user: null})

      filter.intersectWith(publicUserQuery)
    }

    const {results} = await super.$__update({
      context,
      filter,
      update
    })

    return results.map(result => {
      const id = this.encodeModelAccessKey(result.user)

      return new this({...result, _id: id})
    })
  }
}

BaseAccess.customRoutes = {
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

BaseAccess.fields = {
  user: {
    type: 'base_user',
    required: true
  },
  model: {
    type: String,
    required: true,
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

BaseAccess.handle = 'base_access'

module.exports = BaseAccess
