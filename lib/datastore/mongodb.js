const {MongoClient, ObjectID} = require('mongodb')
const EntryId = require('../entryId')
const isPlainObject = require('../utils/isPlainObject')
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

  static transformObjectIds(input, op = 'encode') {
    if (!isPlainObject(input)) {
      // (!) TO DO: Needs revisiting. We can't blindly convert to ObjectID
      // any values that might be one.
      if (op === 'encode' && ObjectID.isValid(input)) {
        return ObjectID.createFromHexString(input)
      }

      if (op === 'decode' && input instanceof ObjectID) {
        return input.toString()
      }

      return input
    }

    return Object.keys(input).reduce((result, key) => {
      const value = input[key]

      if (Array.isArray(value)) {
        return {
          ...result,
          [key]: value.map(child => this.transformObjectIds(child, op))
        }
      }

      return {
        ...result,
        [key]: this.transformObjectIds(value, op)
      }
    }, {})
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
      poolSize: POOL_SIZE,
      useUnifiedTopology: true
    })

    connectionPool = connection

    return connection
  }

  async createOne({entry, modelName}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const encodedEntry = MongoStore.transformObjectIds(entry, 'encode')
    const {ops} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .insertOne(encodedEntry)

    return ops[0]
  }

  async deleteOneById({id, modelName}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const encodedId = MongoStore.transformObjectIds(id, 'encode')
    const {result} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .deleteOne({_id: encodedId})

    return {deleteCount: result.n}
  }

  /**
   * Finds entries matching a query.
   *
   * @param  {String} modelName
   * @param  {Object} query
   */
  async find({fieldSet, filter, modelName, pageNumber = 1, pageSize, schema}) {
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
    const encodedQuery = MongoStore.transformObjectIds(query, 'encode', schema)
    const cursor = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .find(encodedQuery, options)
    const count = await cursor.count()
    const results = await cursor.toArray()
    const decodedResults = results.map(result =>
      MongoStore.transformObjectIds(result, 'decode')
    )

    return {count, results: decodedResults}
  }

  async findManyById({fieldSet, filter, ids, modelName}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const encodedIds = ids.map(ObjectID.createFromHexString)
    const options = {
      projection: MongoStore.getProjectionFromFieldSet(fieldSet)
    }
    const query = QueryFilter.parse({_id: {$in: encodedIds}}, '$')

    if (filter) {
      query.intersectWith(filter)
    }

    const results = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .find(query.toObject('$'), options)
      .toArray()
    const decodedResults = results.map(result =>
      MongoStore.transformObjectIds(result, 'decode')
    )

    return decodedResults
  }

  async findOneById({fieldSet, filter, id, modelName}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const encodedId = ObjectID.createFromHexString(id)
    const options = {
      projection: MongoStore.getProjectionFromFieldSet(fieldSet)
    }
    const query = QueryFilter.parse({_id: encodedId}, '$')

    if (filter) {
      query.intersectWith(filter)
    }

    const result = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .findOne(query.toObject('$'), options)
    const decodedResult = MongoStore.transformObjectIds(result, 'decode')

    return decodedResult
  }

  async setupModel() {
    console.log('HIII!!!', arguments)
  }

  async update({filter, modelName, update}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateMany(filter.toObject('$'), {$set: update})

    return this.find({filter, modelName})
  }

  async updateOneById({id, modelName, update}) {
    const connection = await this.connect()
    const collectionName = MongoStore.getCollectionName({modelName})
    const encodedId = MongoStore.transformObjectIds(id, 'encode')

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateOne({_id: encodedId}, {$set: update})

    return this.findOneById({id, modelName})
  }
}

module.exports = MongoStore
