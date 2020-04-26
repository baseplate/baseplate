const {MongoClient, ObjectID} = require('mongodb')
const QueryFilter = require('../queryFilter')

const POOL_SIZE = 10

let connectionPool

class MongoStore {
  /**
   * Creates a new instance of MongoStore.
   *
   * @param  {String} connectionString
   * @param  {String} databaseName
   */
  constructor({connectionString, databaseName}) {
    this.connectionString = connectionString
    this.databaseName = databaseName
  }

  static getProjectionFromFieldsArray(fields) {
    if (!fields || !Array.isArray(fields)) {
      return null
    }

    const projection = fields.concat('_id').reduce(
      (result, fieldName) => ({
        ...result,
        [fieldName]: 1
      }),
      {}
    )

    return projection
  }

  /**
   * Initiates a connection with MongoDB, taking into account the connection
   * pool, and creates two instance variables:
   *
   * - `this.connection`: The Mongo connection instance
   * - `this.database`: An instance to the database named`this.databaseName`
   */
  async connect() {
    let connection

    if (connectionPool && connectionPool.isConnected()) {
      connection = connectionPool
    } else {
      connection = await MongoClient.connect(this.connectionString, {
        poolSize: POOL_SIZE
      })

      connectionPool = connection
    }

    this.connection = connection
    this.database = connection.db(this.databaseName)
  }

  createOne({entry, modelName}) {
    const collectionName = this.getCollectionName({modelName})

    return this.database.collection(collectionName).insertOne(entry)
  }

  async deleteOneById({id, modelName}) {
    const collectionName = this.getCollectionName({modelName})
    const objectId = this.ensureNativeObjectId(id)
    const {result} = await this.database
      .collection(collectionName)
      .deleteOne({_id: objectId})

    return result
  }

  ensureNativeObjectId(id) {
    if (id instanceof ObjectID) {
      return id
    }

    if (ObjectID.isValid(id)) {
      return ObjectID.createFromHexString(id)
    }

    return null
  }

  /**
   * Finds entries matching a query.
   *
   * @param  {String} modelName
   * @param  {Object} query
   */
  async find({
    fields,
    modelName,
    pageNumber = 1,
    pageSize,
    query: queryFilter
  }) {
    const collectionName = this.getCollectionName({modelName})
    const options = {
      projection: MongoStore.getProjectionFromFieldsArray(fields)
    }

    if (pageSize) {
      options.limit = pageSize
      options.skip = (pageNumber - 1) * pageSize
    }

    const query = queryFilter ? queryFilter.toObject('$') : {}
    const cursor = await this.database
      .collection(collectionName)
      .find(query, options)
    const count = await cursor.count()
    const results = await cursor.toArray()

    return {count, results}
  }

  findManyById({fieldSet, filter, ids, modelName}) {
    const collectionName = this.getCollectionName({modelName})
    const objectIds = ids.map(this.ensureNativeObjectId).filter(Boolean)
    const options = {
      projection: MongoStore.getProjectionFromFieldsArray(fieldSet)
    }
    const query = QueryFilter.parse({_id: {$in: objectIds}}, '$')

    if (filter) {
      query.intersectWith(filter)
    }

    return this.database
      .collection(collectionName)
      .find(query.toObject('$'), options)
      .toArray()
  }

  findOneById({id, modelName}) {
    const collectionName = this.getCollectionName({modelName})
    const objectId = this.ensureNativeObjectId(id)

    return this.database.collection(collectionName).findOne({_id: objectId})
  }

  getCollectionName({modelName, type}) {
    if (type === 'access') {
      return `access_${modelName}`
    }

    if (modelName.startsWith('_')) {
      return `internal${modelName}`
    }

    return `model_${modelName}`
  }

  async getUserAccessForResource({
    accessType,
    includePublicUser,
    modelName,
    userId
  }) {
    const collectionName = this.getCollectionName({modelName, type: 'access'})
    const userIds = []

    if (userId) {
      userIds.push(this.ensureNativeObjectId(userId))
    }

    if (includePublicUser) {
      userIds.push('public')
    }

    const queryValue = userIds.length === 1 ? userIds[0] : {$in: userIds}
    const accessEntries = await this.database
      .collection(collectionName)
      .find({user: queryValue})
      .toArray()
    const normalizedAccessEntries = accessEntries.map(entry => {
      if (!entry || entry[accessType] === undefined) {
        return false
      }

      if (typeof entry[accessType] === 'boolean') {
        return entry[accessType]
      }

      const filter = entry[accessType].filter
        ? QueryFilter.parse(entry[accessType].filter, '_')
        : undefined

      return {
        ...entry[accessType],
        filter
      }
    })

    return normalizedAccessEntries
  }

  async updateOneById({id, modelName, update}) {
    const collectionName = this.getCollectionName({modelName})
    const objectId = this.ensureNativeObjectId(id)

    await this.database
      .collection(collectionName)
      .updateMany({_id: objectId}, {$set: update})

    return this.findOneById({id, modelName})
  }
}

module.exports = MongoStore
