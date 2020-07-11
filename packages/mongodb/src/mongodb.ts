import {FindOneOptions, MongoClient, ObjectID} from 'mongodb'

import {
  BaseModel,
  Context,
  createLogger,
  DataConnector,
  FieldSet,
  QueryFilter,
  QueryFilterField,
} from '@baseplate/core'

const POOL_SIZE = 10

const logger = createLogger('mongodb')

let connectionPool: MongoClient

export default class MongoDB extends DataConnector.DataConnector {
  databaseName: string
  host: string
  username?: string
  password?: string

  constructor(
    databaseName: string = process.env.MONGODB_DATABASE,
    host: string = process.env.MONGODB_HOST,
    username: string = process.env.MONGODB_USERNAME,
    password: string = process.env.MONGODB_PASSWORD
  ) {
    super()

    this.databaseName = databaseName
    this.host = host
    this.username = username
    this.password = password
  }

  private async connect() {
    if (connectionPool && connectionPool.isConnected()) {
      return connectionPool
    }

    const connectionString = this.createConnectionString()
    const connection = await MongoClient.connect(connectionString, {
      poolSize: POOL_SIZE,
      useUnifiedTopology: true,
    })

    connectionPool = connection

    logger.debug('Connected to MongoDB')

    return connection
  }

  private createConnectionString() {
    const credentials =
      this.username && this.password
        ? `${encodeURIComponent(this.username)}:${encodeURIComponent(
            this.password
          )}@`
        : ''
    const connectionString = `mongodb://${credentials}${this.host}/${this.databaseName}`

    return connectionString
  }

  private base$mongoDBDecodeObjectId(input: any) {
    return input.toString()
  }

  private encodeAndDecodeObjectIdsInEntry(
    entry: DataConnector.Result,
    Model: typeof BaseModel,
    opType: 'encode' | 'decode'
  ) {
    if (!entry) return entry

    const opMethod =
      opType === 'encode'
        ? this.encodeObjectId
        : this.base$mongoDBDecodeObjectId
    const encodedEntry: DataConnector.Result = Object.entries(entry).reduce(
      (encodedEntry, [fieldName, value]) => {
        let encodedValue = value

        if (fieldName === '_id') {
          value = opMethod(value)
        }

        if (Model.base$schema.isReferenceField(fieldName)) {
          const references = Array.isArray(value) ? value : [value]
          const encodedReferences = references.map((reference) => {
            return reference && reference.id
              ? {...reference, id: opMethod(reference.id)}
              : reference
          })

          encodedValue = Array.isArray(value)
            ? encodedReferences
            : encodedReferences[0]
        }

        return {
          ...encodedEntry,
          [fieldName]: encodedValue,
        }
      },
      {}
    )

    return encodedEntry
  }

  private encodeObjectId(input: any): any {
    if (Array.isArray(input)) {
      return input.map(this.encodeObjectId)
    }

    if (typeof input === 'string' && ObjectID.isValid(input)) {
      return ObjectID.createFromHexString(input)
    }

    return input
  }

  private encodeQuery(query: QueryFilter, Model: typeof BaseModel) {
    const encodedQuery = query.clone()

    encodedQuery.traverse((fieldPath: string, field: QueryFilterField) => {
      const fieldPathNodes = fieldPath.split('.')

      // We're looking for queries on reference fields, since the `id` field
      // needs to be cast to ObjectID.
      //
      // (!) TO DO: This should be a more comprehensive mechanism that is able
      // to detect every single place a node might need to be cast to ObjectID.
      if (
        (Model.base$schema.isReferenceField(fieldPathNodes[0]) &&
          fieldPathNodes[1] === 'id') ||
        fieldPath === '_id'
      ) {
        field.value = this.encodeObjectId(field.value)
      }
    })

    return encodedQuery
  }

  private getCollectionName(Model: typeof BaseModel) {
    if (Model.base$isInternal()) {
      return Model.base$handle.replace('$', '_')
    }

    return `model_${Model.base$handle}`
  }

  private getProjectionFromFieldSet(fieldSet: FieldSet) {
    if (!fieldSet) {
      return
    }

    const fields = fieldSet.toArray()
    const projection = fields.concat('_id').reduce(
      (result, fieldName) => ({
        ...result,
        [fieldName]: 1,
      }),
      {}
    )

    return projection
  }

  async bootstrap() {}

  async createOne(
    entry: DataConnector.Result,
    Model: typeof BaseModel
  ): Promise<DataConnector.Result> {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const encodedEntry = this.encodeAndDecodeObjectIdsInEntry(
      entry,
      Model,
      'encode'
    )
    const {ops} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .insertOne(encodedEntry)
    const decodedResult = this.encodeAndDecodeObjectIdsInEntry(
      ops[0],
      Model,
      'decode'
    )

    return decodedResult
  }

  async delete(filter: QueryFilter, Model: typeof BaseModel) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const query = filter ? this.encodeQuery(filter, Model).toObject('$') : {}
    const {result} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .deleteMany(query)

    return {deleteCount: result.n}
  }

  async deleteOneById(id: string, Model: typeof BaseModel) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const encodedId = ObjectID.createFromHexString(id)
    const {result} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .deleteOne({_id: encodedId})

    return {deleteCount: result.n}
  }

  async find(
    {fieldSet, filter, pageNumber = 1, pageSize}: DataConnector.FindParameters,
    Model: typeof BaseModel
  ) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const options: FindOneOptions = {
      projection: this.getProjectionFromFieldSet(fieldSet),
    }

    if (pageSize) {
      options.limit = pageSize
      options.skip = (pageNumber - 1) * pageSize
    }

    const query = filter ? this.encodeQuery(filter, Model).toObject('$') : {}
    const cursor = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .find(query, options)
    const count = await cursor.count()
    const results = await cursor.toArray()
    const decodedResults: DataConnector.Results = results.map(
      (result: DataConnector.Result) =>
        this.encodeAndDecodeObjectIdsInEntry(result, Model, 'decode')
    )

    return {count, results: decodedResults}
  }

  async findManyById(
    {fieldSet, filter, ids}: DataConnector.FindManyByIdParameters,
    Model: typeof BaseModel,
    context: Context
  ) {
    logger.debug('findManyById: %s', ids, {
      model: Model.base$handle,
    })

    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const encodedIds = ids.map(ObjectID.createFromHexString)
    const options = {
      projection: this.getProjectionFromFieldSet(fieldSet),
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
    const decodedResults: DataConnector.Results = results.map(
      (result: DataConnector.Result) =>
        this.encodeAndDecodeObjectIdsInEntry(result, Model, 'decode')
    )

    return decodedResults
  }

  async findOneById(
    {batch, fieldSet, filter, id}: DataConnector.FindOneByIdParameters,
    Model: typeof BaseModel,
    context: Context
  ) {
    if (batch) {
      return MongoDB.batchFindOneById(
        {fieldSet, filter, id},
        context,
        (ids: string[]) =>
          this.findManyById({fieldSet, filter, ids}, Model, context)
      )
    }

    logger.debug('findOneById: %s', id, {model: Model.base$handle})

    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const encodedId = ObjectID.createFromHexString(id)
    const options = {
      projection: this.getProjectionFromFieldSet(fieldSet),
    }
    const query = QueryFilter.parse({_id: encodedId}, '$')

    if (filter) {
      query.intersectWith(filter)
    }

    const result = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .findOne(query.toObject('$'), options)
    const decodedResult = this.encodeAndDecodeObjectIdsInEntry(
      result,
      Model,
      'decode'
    )

    return decodedResult
  }

  async update(
    filter: QueryFilter,
    update: Record<string, any>,
    Model: typeof BaseModel
  ) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateMany(filter.toObject('$'), {$set: update})

    return this.find({filter}, Model)
  }

  async updateOneById(
    id: string,
    update: Record<string, any>,
    Model: typeof BaseModel,
    context: Context
  ) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const encodedId = ObjectID.createFromHexString(id)

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateOne({_id: encodedId}, {$set: update})

    return this.findOneById({id}, Model, context)
  }
}

module.exports = MongoDB
