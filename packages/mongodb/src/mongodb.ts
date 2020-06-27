import {FindOneOptions, MongoClient, ObjectID} from 'mongodb'

import ModelInterface, {
  FindManyByIdParameters,
  FindOneByIdParameters,
  FindParameters,
} from '@baseplate/core/dist/lib/model/interface'
import {FieldSetType} from '@baseplate/core/dist/lib/fieldSet'
import QueryFilter from '@baseplate/core/dist/lib/queryFilter'

const POOL_SIZE = 10

let connectionPool: MongoClient

export default class MongoDB extends ModelInterface {
  static databaseName = process.env.MONGODB_DATABASE

  static async $__dbCreateOne(entry: MongoDB): Promise<MongoDB> {
    const connection = await this.$__mongoDBConnect()
    const collectionName = this.$__mongoDBGetCollectionName()
    const {ops} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .insertOne(entry)

    return ops[0]
  }

  static async $__dbDeleteOneById(id: string) {
    const connection = await this.$__mongoDBConnect()
    const collectionName = this.$__mongoDBGetCollectionName()
    const encodedId = ObjectID.createFromHexString(id)
    const {result} = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .deleteOne({_id: encodedId})

    return {deleteCount: result.n}
  }

  static async $__dbFind({
    fieldSet,
    filter,
    pageNumber = 1,
    pageSize,
  }: FindParameters) {
    const connection = await this.$__mongoDBConnect()
    const collectionName = this.$__mongoDBGetCollectionName()
    const options: FindOneOptions = {
      projection: this.$__mongoDBGetProjectionFromFieldSet(fieldSet),
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

    return {count, results}
  }

  static async $__dbFindManyById({
    fieldSet,
    filter,
    ids,
  }: FindManyByIdParameters) {
    const connection = await this.$__mongoDBConnect()
    const collectionName = this.$__mongoDBGetCollectionName()
    const encodedIds = ids.map(ObjectID.createFromHexString)
    const options = {
      projection: this.$__mongoDBGetProjectionFromFieldSet(fieldSet),
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

    return results
  }

  static async $__dbFindOneById({fieldSet, filter, id}: FindOneByIdParameters) {
    const connection = await this.$__mongoDBConnect()
    const collectionName = this.$__mongoDBGetCollectionName()
    const encodedId = ObjectID.createFromHexString(id)
    const options = {
      projection: this.$__mongoDBGetProjectionFromFieldSet(fieldSet),
    }
    const query = QueryFilter.parse({_id: encodedId}, '$')

    if (filter) {
      query.intersectWith(filter)
    }

    const result = await connection
      .db(this.databaseName)
      .collection(collectionName)
      .findOne(query.toObject('$'), options)

    return result
  }

  static async $__dbSetup() {}

  static async $__dbUpdate(filter: QueryFilter, update: Record<string, any>) {
    const connection = await this.$__mongoDBConnect()
    const collectionName = this.$__mongoDBGetCollectionName()

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateMany(filter.toObject('$'), {$set: update})

    return this.$__dbFind({filter})
  }

  static async $__dbUpdateOneById(id: string, update: Record<string, any>) {
    const connection = await this.$__mongoDBConnect()
    const collectionName = this.$__mongoDBGetCollectionName()
    const encodedId = ObjectID.createFromHexString(id)

    await connection
      .db(this.databaseName)
      .collection(collectionName)
      .updateOne({_id: encodedId}, {$set: update})

    return this.$__dbFindOneById({id})
  }

  static async $__mongoDBConnect() {
    if (connectionPool && connectionPool.isConnected()) {
      return connectionPool
    }

    const connectionString = this.$__mongoDBCreateConnectionString()
    const connection = await MongoClient.connect(connectionString, {
      poolSize: POOL_SIZE,
      useUnifiedTopology: true,
    })

    connectionPool = connection

    return connection
  }

  static $__mongoDBCreateConnectionString() {
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

  static $__mongoDBGetCollectionName() {
    if (this.isBaseModel) {
      return this.handle
    }

    return `model_${this.handle}`
  }

  static $__mongoDBGetProjectionFromFieldSet(fieldSet: FieldSetType) {
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

  // static $__mongoDBTransformObjectIds(
  //   input: Record<string, any> | string,
  //   op = 'encode'
  // ): Record<string, any> | string {
  //   if (!isPlainObject(input)) {
  //     // (!) TO DO: Needs revisiting. We can't blindly convert to ObjectID
  //     // any values that might be one.
  //     if (
  //       op === 'encode' &&
  //       typeof input === 'string' &&
  //       ObjectID.isValid(input)
  //     ) {
  //       return ObjectID.createFromHexString(input)
  //     }

  //     if (op === 'decode' && input instanceof ObjectID) {
  //       return input.toString()
  //     }

  //     return input
  //   }

  //   return Object.keys(input).reduce((result, key) => {
  //     const value = input[key]

  //     if (Array.isArray(value)) {
  //       return {
  //         ...result,
  //         [key]: value.map((child) =>
  //           this.$__mongoDBTransformObjectIds(child, op)
  //         ),
  //       }
  //     }

  //     return {
  //       ...result,
  //       [key]: this.$__mongoDBTransformObjectIds(value, op),
  //     }
  //   }, {})
  // }
}

module.exports = MongoDB
