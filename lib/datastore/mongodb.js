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

  static convertObjectIdsToStringsInObject(object) {
    if (!object) return object

    const newObject = Object.entries(object).reduce((result, [key, value]) => {
      return {
        ...result,
        [key]: value instanceof ObjectID ? value.toString() : value
      }
    }, {})

    return newObject
  }

  static ensureNativeObjectId(id) {
    if (id instanceof ObjectID) {
      return id
    }

    if (ObjectID.isValid(id)) {
      return ObjectID.createFromHexString(id)
    }

    return null
  }

  static getCollectionName({modelName, type}) {
    if (type === 'access') {
      return 'internal_access'
    }

    if (modelName.startsWith('_')) {
      return `internal${modelName}`
    }

    return `model_${modelName}`
  }

  static getProjectionFromFieldSet(fieldSet) {
    if (!fieldSet || !Array.isArray(fieldSet)) {
      return
    }

    const projection = fieldSet.concat('_id').reduce(
      (result, fieldName) => ({
        ...result,
        [fieldName]: 1
      }),
      {}
    )

    return projection
  }

  async connect() {
    this.connection = this.connection || this.createConnection()

    return this.connection
  }

  /**
   * Initiates a connection with MongoDB, taking into account the connection
   * pool.
   */
  async createConnection() {
    if (connectionPool && connectionPool.isConnected()) {
      return connectionPool
    }

    const connection = await MongoClient.connect(this.connectionString, {
      poolSize: POOL_SIZE
    })

    connectionPool = connection

    return connection
  }

  async createOne({entry, modelName}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})

    return connection
      .db(this.databaseName)
      .collection(collectionName)
      .insertOne(entry)
  }

  async deleteOneById({id, modelName}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const objectId = MongoStore.ensureNativeObjectId(id)
    const {result} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .deleteOne({_id: objectId})

    return result
  }

  /**
   * Finds entries matching a query.
   *
   * @param  {String} modelName
   * @param  {Object} query
   */
  async find({fieldSet, filter, modelName, pageNumber = 1, pageSize}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const options = {
      projection: MongoStore.getProjectionFromFieldSet(fieldSet)
    }

    if (pageSize) {
      options.limit = pageSize
      options.skip = (pageNumber - 1) * pageSize
    }

    const query = filter ? filter.toObject('$') : {}
    const cursor = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .find(query, options)
    const count = await cursor.count()
    const results = await cursor.toArray()
    const normalizedResults = results.map(
      MongoStore.convertObjectIdsToStringsInObject
    )

    return {count, results: normalizedResults}
  }

  async findManyById({fieldSet, filter, ids, modelName}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const objectIds = ids.map(MongoStore.ensureNativeObjectId).filter(Boolean)
    const options = {
      projection: MongoStore.getProjectionFromFieldSet(fieldSet)
    }
    const query = QueryFilter.parse({_id: {$in: objectIds}}, '$')

    if (filter) {
      query.intersectWith(filter)
    }

    const results = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .find(query.toObject('$'), options)
      .toArray()

    return results.map(MongoStore.convertObjectIdsToStringsInObject)
  }

  async findOneById({fieldSet, filter, id, modelName}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const objectId = MongoStore.ensureNativeObjectId(id)
    const options = {
      projection: MongoStore.getProjectionFromFieldSet(fieldSet)
    }
    const query = QueryFilter.parse({_id: objectId}, '$')

    if (filter) {
      query.intersectWith(filter)
    }

    const result = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .findOne(query.toObject('$'), options)

    return MongoStore.convertObjectIdsToStringsInObject(result)
  }

  async getUserAccess({includePublicUser, user}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({type: 'access'})
    const userIds = []

    if (includePublicUser) {
      userIds.push('public')
    }

    if (user) {
      userIds.push(MongoStore.ensureNativeObjectId(user.id))
    }

    console.log('DB!')

    const queryValue = userIds.length === 1 ? userIds[0] : {$in: userIds}
    const userAccess = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .find({user: queryValue})
      .toArray()

    return userAccess.map(MongoStore.convertObjectIdsToStringsInObject)
  }

  async updateOneById({id, modelName, update}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const objectId = MongoStore.ensureNativeObjectId(id)

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateMany({_id: objectId}, {$set: update})

    return this.findOneById({id, modelName})
  }
}

module.exports = MongoStore
