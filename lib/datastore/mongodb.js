const {MongoClient, ObjectID} = require('mongodb')

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

  findManyById({ids, modelName}) {
    const collectionName = this.getCollectionName({modelName})
    const objectIds = ids.map(this.ensureNativeObjectId).filter(Boolean)

    return this.database
      .collection(collectionName)
      .find({_id: {$in: objectIds}})
      .toArray()
  }

  findOneById({id, modelName}) {
    const collectionName = this.getCollectionName({modelName})
    const objectId = this.ensureNativeObjectId(id)

    return this.database
      .collection(collectionName)
      .find({_id: objectId})
      .toArray()
  }

  getCollectionName({modelName}) {
    if (modelName[0] === '_') {
      return `internal${modelName}`
    }

    return `model_${modelName}`
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
