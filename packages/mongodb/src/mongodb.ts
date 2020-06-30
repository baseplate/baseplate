import {FindOneOptions, MongoClient, ObjectID} from 'mongodb'

import ModelInterface, {
  FindManyByIdParameters,
  FindOneByIdParameters,
  FindParameters,
} from '@baseplate/core/dist/lib/model/interface'
import {FieldSetType} from '@baseplate/core/dist/lib/fieldSet'
import QueryFilter, {
  Field as QueryFilterField,
} from '@baseplate/core/dist/lib/queryFilter'

const POOL_SIZE = 10

let connectionPool: MongoClient

export default class MongoDB extends ModelInterface {
  static databaseName = process.env.MONGODB_DATABASE

  static async base$dbCreateOne(entry: MongoDB): Promise<MongoDB> {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName()
    const encodedEntry = this.base$mongoDBEncodeAndDecodeObjectIdsInEntry(
      entry,
      'encode'
    )
    const {ops} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .insertOne(encodedEntry)
    const decodedResult = this.base$mongoDBEncodeAndDecodeObjectIdsInEntry(
      ops[0],
      'decode'
    )

    return decodedResult
  }

  static async base$dbDeleteOneById(id: string) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName()
    const encodedId = ObjectID.createFromHexString(id)
    const {result} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .deleteOne({_id: encodedId})

    return {deleteCount: result.n}
  }

  static async base$dbFind({
    fieldSet,
    filter,
    pageNumber = 1,
    pageSize,
  }: FindParameters) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName()
    const options: FindOneOptions = {
      projection: this.base$mongoDBGetProjectionFromFieldSet(fieldSet),
    }

    if (pageSize) {
      options.limit = pageSize
      options.skip = (pageNumber - 1) * pageSize
    }

    const query = filter
      ? this.base$mongoDBEncodeQuery(filter).toObject('$')
      : {}
    const cursor = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .find(query, options)
    const count = await cursor.count()
    const results = await cursor.toArray()
    const decodedResults = results.map((result) =>
      this.base$mongoDBEncodeAndDecodeObjectIdsInEntry(result, 'decode')
    )

    return {count, results: decodedResults}
  }

  static async base$dbFindManyById({
    fieldSet,
    filter,
    ids,
  }: FindManyByIdParameters) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName()
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
      this.base$mongoDBEncodeAndDecodeObjectIdsInEntry(result, 'decode')
    )

    console.log('-> 2', query, options)

    return decodedResults
  }

  static async base$dbFindOneById({
    fieldSet,
    filter,
    id,
  }: FindOneByIdParameters) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName()
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
      'decode'
    )

    return decodedResult
  }

  static async base$dbSetup() {}

  static async base$dbUpdate(filter: QueryFilter, update: Record<string, any>) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName()

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateMany(filter.toObject('$'), {$set: update})

    return this.base$dbFind({filter})
  }

  static async base$dbUpdateOneById(id: string, update: Record<string, any>) {
    const connection = await this.base$mongoDBConnect()
    const collectionName = this.base$mongoDBGetCollectionName()
    const encodedId = ObjectID.createFromHexString(id)

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateOne({_id: encodedId}, {$set: update})

    return this.base$dbFindOneById({id})
  }

  static async base$mongoDBConnect() {
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

  static base$mongoDBCreateConnectionString() {
    const username = process.env.MONGODB_USERNAME
    const password = process.env.MONGODB_PASSWORD
    const credentials =
      username && password
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        : ''
    const host = process.env.MONGODB_HOST
    const connectionString = `mongodb://${credentials}${host}/${MongoDB.databaseName}`

    return connectionString
  }

  static base$mongoDBDecodeObjectId(input: any) {
    return input.toString()
  }

  static base$mongoDBEncodeAndDecodeObjectIdsInEntry(
    entry: MongoDB,
    opType: 'encode' | 'decode'
  ) {
    if (!entry) return entry

    const opMethod =
      opType === 'encode'
        ? this.base$mongoDBEncodeObjectId
        : this.base$mongoDBDecodeObjectId
    const encodedEntry = Object.entries(entry).reduce(
      (encodedEntry, [fieldName, value]) => {
        let encodedValue = value

        if (fieldName === '_id') {
          value = opMethod(value)
        }

        if (this.schema.isReferenceField(fieldName)) {
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

  static base$mongoDBEncodeObjectId(input: any): any {
    if (Array.isArray(input)) {
      return input.map(this.base$mongoDBEncodeObjectId)
    }

    if (typeof input === 'string' && ObjectID.isValid(input)) {
      return ObjectID.createFromHexString(input)
    }

    return input
  }

  static base$mongoDBEncodeQuery(query: QueryFilter) {
    const encodedQuery = query.clone()

    encodedQuery.traverse((fieldPath: string, field: QueryFilterField) => {
      const fieldPathNodes = fieldPath.split('.')

      // We're looking for queries on reference fields, since the `id` field
      // needs to be cast to ObjectID.
      //
      // (!) TO DO: This should be a more comprehensive mechanism that is able
      // to detect every single place a node might need to be cast to ObjectID.
      if (
        (this.schema.isReferenceField(fieldPathNodes[0]) &&
          fieldPathNodes[1] === 'id') ||
        fieldPath === '_id'
      ) {
        field.value = this.base$mongoDBEncodeObjectId(field.value)
      }
    })

    return encodedQuery
  }

  static base$mongoDBGetCollectionName() {
    if (this.isBaseModel) {
      return this.handle
    }

    return `model_${this.handle}`
  }

  static base$mongoDBGetProjectionFromFieldSet(fieldSet: FieldSetType) {
    if (!fieldSet || !Array.isArray(fieldSet)) {
      return
    }

    const projection = fieldSet.concat('_id').reduce(
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