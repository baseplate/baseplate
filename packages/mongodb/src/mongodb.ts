import {FindOneOptions, MongoClient, ObjectID} from 'mongodb'

import {
  BaseModel,
  FieldSet,
  QueryFilter,
  QueryFilterField,
} from '@baseplate/core'
import {
  DataConnector,
  FindManyByIdParameters,
  FindOneByIdParameters,
  FindParameters,
  Result,
} from '@baseplate/data-connector'

const POOL_SIZE = 10

let connectionPool: MongoClient

export default class MongoDB extends DataConnector {
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

  async base$dbCreateOne(
    entry: Result,
    model: typeof BaseModel
  ): Promise<Result> {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName(model)
    const encodedEntry = this.base$mongoDBEncodeAndDecodeObjectIdsInEntry(
      entry,
      model,
      'encode'
    )
    const {ops} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .insertOne(encodedEntry)
    const decodedResult = this.base$mongoDBEncodeAndDecodeObjectIdsInEntry(
      ops[0],
      model,
      'decode'
    )

    return decodedResult
  }

  async base$dbDelete(filter: QueryFilter, model: typeof BaseModel) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName(model)
    const query = filter
      ? this.base$mongoDBEncodeQuery(filter, model).toObject('$')
      : {}
    const {result} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .deleteMany(query)

    return {deleteCount: result.n}
  }

  async base$dbDeleteOneById(id: string, model: typeof BaseModel) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName(model)
    const encodedId = ObjectID.createFromHexString(id)
    const {result} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .deleteOne({_id: encodedId})

    return {deleteCount: result.n}
  }

  async base$dbFind(
    {fieldSet, filter, pageNumber = 1, pageSize}: FindParameters,
    model: typeof BaseModel
  ) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName(model)
    const options: FindOneOptions = {
      projection: this.base$mongoDBGetProjectionFromFieldSet(fieldSet),
    }

    if (pageSize) {
      options.limit = pageSize
      options.skip = (pageNumber - 1) * pageSize
    }

    const query = filter
      ? this.base$mongoDBEncodeQuery(filter, model).toObject('$')
      : {}
    const cursor = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .find(query, options)
    const count = await cursor.count()
    const results = await cursor.toArray()
    const decodedResults = results.map((result) =>
      this.base$mongoDBEncodeAndDecodeObjectIdsInEntry(result, model, 'decode')
    )

    return {count, results: decodedResults}
  }

  async base$dbFindManyById(
    {fieldSet, filter, ids}: FindManyByIdParameters,
    model: typeof BaseModel
  ) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName(model)
    const encodedIds = ids.map(ObjectID.createFromHexString)
    const options = {
      projection: this.base$mongoDBGetProjectionFromFieldSet(fieldSet),
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
    const decodedResults = results.map((result) =>
      this.base$mongoDBEncodeAndDecodeObjectIdsInEntry(result, model, 'decode')
    )

    return decodedResults
  }

  async base$dbFindOneById(
    {fieldSet, filter, id}: FindOneByIdParameters,
    model: typeof BaseModel
  ) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName(model)
    const encodedId = ObjectID.createFromHexString(id)
    const options = {
      projection: this.base$mongoDBGetProjectionFromFieldSet(fieldSet),
    }
    const query = QueryFilter.parse({_id: encodedId}, '$')

    if (filter) {
      query.intersectWith(filter)
    }

    const result = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .findOne(query.toObject('$'), options)
    const decodedResult = this.base$mongoDBEncodeAndDecodeObjectIdsInEntry(
      result,
      model,
      'decode'
    )

    return decodedResult
  }

  async base$dbSetup() {}

  async base$dbUpdate(
    filter: QueryFilter,
    update: Record<string, any>,
    model: typeof BaseModel
  ) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName(model)

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateMany(filter.toObject('$'), {$set: update})

    return this.base$dbFind({filter}, model)
  }

  async base$dbUpdateOneById(
    id: string,
    update: Record<string, any>,
    model: typeof BaseModel
  ) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName(model)
    const encodedId = ObjectID.createFromHexString(id)

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateOne({_id: encodedId}, {$set: update})

    return this.base$dbFindOneById({id}, model)
  }

  async base$mongoDBConnect() {
    if (connectionPool && connectionPool.isConnected()) {
      return connectionPool
    }

    const connectionString = this.base$mongoDBCreateConnectionString()
    const connection = await MongoClient.connect(connectionString, {
      poolSize: POOL_SIZE,
      useUnifiedTopology: true,
    })

    connectionPool = connection

    return connection
  }

  base$mongoDBCreateConnectionString() {
    const credentials =
      this.username && this.password
        ? `${encodeURIComponent(this.username)}:${encodeURIComponent(
            this.password
          )}@`
        : ''
    const connectionString = `mongodb://${credentials}${this.host}/${this.databaseName}`

    return connectionString
  }

  base$mongoDBDecodeObjectId(input: any) {
    return input.toString()
  }

  base$mongoDBEncodeAndDecodeObjectIdsInEntry(
    entry: Result,
    model: typeof BaseModel,
    opType: 'encode' | 'decode'
  ) {
    if (!entry) return entry

    const opMethod =
      opType === 'encode'
        ? this.base$mongoDBEncodeObjectId
        : this.base$mongoDBDecodeObjectId
    const encodedEntry: Result = Object.entries(entry).reduce(
      (encodedEntry, [fieldName, value]) => {
        let encodedValue = value

        if (fieldName === '_id') {
          value = opMethod(value)
        }

        if (model.schema.isReferenceField(fieldName)) {
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

  base$mongoDBEncodeObjectId(input: any): any {
    if (Array.isArray(input)) {
      return input.map(this.base$mongoDBEncodeObjectId)
    }

    if (typeof input === 'string' && ObjectID.isValid(input)) {
      return ObjectID.createFromHexString(input)
    }

    return input
  }

  base$mongoDBEncodeQuery(query: QueryFilter, model: typeof BaseModel) {
    const encodedQuery = query.clone()

    encodedQuery.traverse((fieldPath: string, field: QueryFilterField) => {
      const fieldPathNodes = fieldPath.split('.')

      // We're looking for queries on reference fields, since the `id` field
      // needs to be cast to ObjectID.
      //
      // (!) TO DO: This should be a more comprehensive mechanism that is able
      // to detect every single place a node might need to be cast to ObjectID.
      if (
        (model.schema.isReferenceField(fieldPathNodes[0]) &&
          fieldPathNodes[1] === 'id') ||
        fieldPath === '_id'
      ) {
        field.value = this.base$mongoDBEncodeObjectId(field.value)
      }
    })

    return encodedQuery
  }

  base$mongoDBGetCollectionName(model: typeof BaseModel) {
    if (model.isBaseModel) {
      return model.handle
    }

    return `model_${model.handle}`
  }

  base$mongoDBGetProjectionFromFieldSet(fieldSet: FieldSet) {
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
}

module.exports = MongoDB
