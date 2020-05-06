const {EntryNotFoundError, ModelNotFoundError} = require('../errors')
const JsonApiRequest = require('../specs/jsonApi/request')
const JsonApiResponse = require('../specs/jsonApi/response')
const AccessValue = require('../accessValue')
const BaseModel = require('../model')
const EntryId = require('../entryId')
const modelStore = require('../modelStore')
const QueryFilter = require('../queryFilter')
const Schema = require('../schema')

class ModelAccessController {
  static async createModelAccessEntry(req, res) {
    try {
      const Model = modelStore.get(req.params.modelName, {
        context: this.context
      })

      if (!Model) {
        throw new ModelNotFoundError({name: req.params.modelName})
      }

      const request = new JsonApiRequest(req, this.context)
      const fields = await request.getEntryFieldsFromBody()
      const modelAccess = await this.create({
        entryFields: {
          ...fields,
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
      const Model = modelStore.get(req.params.modelName, {
        context: this.context
      })

      if (!Model) {
        throw new ModelNotFoundError({name: req.params.modelName})
      }

      const entries = await this.getAccessEntries({
        modelName: req.params.modelName
      })
      const fieldSets =
        req.url.getQueryParameter('fields', {
          isCSV: true
        }) || {}
      const request = new JsonApiRequest(req, this.context)

      await request.resolveReferences({
        entries,
        fieldSets,
        includeMap: req.url.getQueryParameter('include', {
          isCSV: true,
          isDotPath: true
        })
      })

      const {body, statusCode} = await JsonApiResponse.toObject({
        entries,
        includedReferences: Object.values(request.references),
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
      const Model = modelStore.get(req.params.modelName, {
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
        const UserModel = modelStore.get(userData.modelName, {
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

      const fieldSets =
        req.url.getQueryParameter('fields', {
          isCSV: true
        }) || {}
      const request = new JsonApiRequest(req, this.context)

      await request.resolveReferences({
        entries,
        fieldSets,
        includeMap: req.url.getQueryParameter('include', {
          isCSV: true,
          isDotPath: true
        })
      })

      const {body, statusCode} = await JsonApiResponse.toObject({
        entries: entries[0],
        includedReferences: Object.values(request.references),
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
      const Model = modelStore.get(req.params.modelName, {
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
        const UserModel = modelStore.get(userData.modelName, {
          context: this.context
        })

        if (!UserModel) {
          throw new EntryNotFoundError({id: req.params.id})
        }

        user = new UserModel({_id: userData.id})
      }

      const request = new JsonApiRequest(req, this.context)
      const fields = await request.getEntryFieldsFromBody()
      const [modelAccess] = await this.updateAccessEntry({
        modelName: req.params.modelName,
        update: fields,
        user
      })

      modelAccess.id = this.encodeModelAccessKey(modelAccess.get('user'))

      await request.resolveReferences({
        entries: [modelAccess],
        //fieldSets,
        includeMap: req.url.getQueryParameter('include', {
          isCSV: true,
          isDotPath: true
        })
      })

      const {body, statusCode} = await JsonApiResponse.toObject({
        entries: modelAccess,
        includedReferences: Object.values(request.references),
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

class ModelAccess extends BaseModel {
  static decodeModelAccessKey(key) {
    if (key === 'public') {
      return null
    }

    const match = key.match(/^([^_]*)_(.*)$/)

    if (match) {
      return {
        id: match[1],
        modelName: match[2]
      }
    }
  }

  static encodeModelAccessKey(user) {
    if (!user) {
      return 'public'
    }

    return `${user._id}_${user._type}`
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
        //'user._id': new EntryId(user.id),
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
      modelName: this.name,
      schema: this.schema
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
      modelName: '_modelAccess',
      update
    })

    return results.map(result => {
      const id = this.encodeModelAccessKey(result.user)

      return new this({...result, _id: id})
    })
  }
}

ModelAccess.customRoutes = {
  '/_models/:modelName/access': {
    get: ModelAccessController.findModelAccessEntries,
    post: ModelAccessController.createModelAccessEntry
  },
  '/_models/:modelName/access/:id': {
    get: ModelAccessController.findModelAccessEntry,
    patch: ModelAccessController.updateModelAccessEntry
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

ModelAccess.schema = new Schema({
  fields: {
    user: '_user',
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
  },
  name: '_modelAccess'
})

module.exports = ModelAccess
