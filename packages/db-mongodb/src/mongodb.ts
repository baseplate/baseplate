import {FindOneOptions, MongoClient, ObjectID} from 'mongodb'
import generateHash from 'short-hash'

import {
  BaseModel,
  Context,
  createLogger,
  DataConnector,
  errors,
  FieldSet,
  QueryFilter,
  QueryFilterField,
} from '@baseplate/core'

const MAX_INDEX_LENGTH = 120
const POOL_SIZE = 10

const logger = createLogger('mongodb')

let connectionPool: Promise<MongoClient>

interface MongoIndex {
  fields: Record<string, -1 | 1 | 'text'>
  options: {
    sparse?: boolean
    unique?: boolean
    weights?: Record<string, number>
  }
}

export interface Options {
  name: string
  uri: string
}

export class MongoDB extends DataConnector.DataConnector {
  dbName: string
  uri: string

  constructor({name, uri}: Options) {
    super()

    this.dbName = name
    this.uri = uri
  }

  private async connect() {
    if (!connectionPool) {
      const connectionString = this.createConnectionString()

      connectionPool = MongoClient.connect(connectionString, {
        poolSize: POOL_SIZE,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
    }

    return connectionPool
  }

  private createConnectionString() {
    return this.uri
  }

  private decodeObjectId(input: any) {
    return input.toString()
  }

  private encodeAndDecodeObjectIdsInEntry(
    entry: DataConnector.Result,
    Model: typeof BaseModel,
    opType: 'encode' | 'decode'
  ) {
    if (!entry) return entry

    const opMethod =
      opType === 'encode' ? this.encodeObjectId : this.decodeObjectId
    const encodedEntry: DataConnector.Result = Object.entries(entry).reduce(
      (encodedEntry, [fieldName, value]) => {
        let encodedValue = value

        if (fieldName === '_id') {
          encodedValue = opMethod(value)
        }

        const fieldSchema = Model.base$schema.fields[fieldName]

        if (fieldSchema && fieldSchema.type === 'reference') {
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
    const transformFn = ({
      name,
      operator,
      value,
    }: {
      name: string
      operator: string
      value: any
    }) => {
      const fieldHandler = Model.base$schema.handlers[name]

      if (name === '_id') {
        return this.encodeObjectId(value)
      }

      if (fieldHandler && fieldHandler.type === 'reference') {
        const isMultiReference = Array.isArray(value)
        const elements = (isMultiReference ? value : [value]).map(
          (element: any) => {
            if (element instanceof BaseModel) {
              return {
                id: this.encodeObjectId(element.id),
                type: (<typeof BaseModel>element.constructor).base$handle,
              }
            }

            return element
          }
        )

        return isMultiReference ? elements : elements[0]
      }

      return value
    }

    return query.toObject({
      fieldTransform: transformFn,
    })
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

  async createOne(entry: BaseModel): Promise<DataConnector.Result> {
    const Model = <typeof BaseModel>entry.constructor
    const collectionName = this.getCollectionName(Model)

    try {
      const serializedEntry = await entry.toObject({
        serialize: ({field, value}: any) => {
          if (field.type === 'reference') {
            return Array.isArray(value)
              ? value.map((item) => ({
                  ...item,
                  id: this.encodeObjectId(item.id),
                }))
              : {...value, id: this.encodeObjectId(value.id)}
          }

          return value
        },
      })
      const connection = await this.connect()
      const {ops} = await connection
        .db(this.dbName)
        .collection(collectionName)
        .insertOne(serializedEntry)
      const decodedResult = this.encodeAndDecodeObjectIdsInEntry(
        ops[0],
        Model,
        'decode'
      )

      return decodedResult
    } catch (error) {
      if (error.code === 11000) {
        throw new errors.UniqueConstraintViolatedError()
      }

      throw error
    }
  }

  async delete(filter: QueryFilter, Model: typeof BaseModel) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const query = filter ? this.encodeQuery(filter, Model) : {}
    const {result} = await connection
      .db(this.dbName)
      .collection(collectionName)
      .deleteMany(query)

    return {deleteCount: result.n}
  }

  async deleteOneById(id: string, Model: typeof BaseModel) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const encodedId = this.encodeObjectId(id)
    const {result} = await connection
      .db(this.dbName)
      .collection(collectionName)
      .deleteOne({_id: encodedId})

    return {deleteCount: result.n}
  }

  async disconnect() {
    const connection = await this.connect()

    return connection.close()
  }

  async find(
    {
      fieldSet,
      filter,
      pageNumber = 1,
      pageSize,
      sort = {},
    }: DataConnector.FindParameters,
    Model: typeof BaseModel,
    context?: Context,
    cache = true
  ) {
    if (cache && context) {
      const parameters = {fieldSet, filter, pageNumber, pageSize, sort}

      return context.getFromCacheOrOrigin<DataConnector.FindReturnValue>(
        () => this.find(parameters, Model, context, false),
        JSON.stringify(parameters)
      )
    }

    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const options: FindOneOptions = {
      projection: this.getProjectionFromFieldSet(fieldSet),
    }

    if (pageSize) {
      options.limit = pageSize
      options.skip = (pageNumber - 1) * pageSize
    }

    const query = filter ? this.encodeQuery(filter, Model) : {}

    logger.debug('find: %o', query, {
      model: Model.base$handle,
    })

    const cursor = await connection
      .db(this.dbName)
      .collection(collectionName)
      .find(query, options)
      .sort(sort)
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
    const encodedIds = ids.map(this.encodeObjectId)
    const options = {
      projection: this.getProjectionFromFieldSet(fieldSet),
    }
    const query = new QueryFilter({_id: {$in: encodedIds}}, '$').intersectWith(
      filter
    )
    const results = await connection
      .db(this.dbName)
      .collection(collectionName)
      .find(query.toObject({operatorPrefix: '$'}), options)
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
    context?: Context,
    cache = true
  ) {
    if (cache && context) {
      return context.getFromCacheOrOrigin<DataConnector.Result>(
        () =>
          this.findOneById(
            {batch, fieldSet, filter, id},
            Model,
            context,
            false
          ),
        JSON.stringify({fieldSet, filter, id})
      )
    }

    if (batch) {
      return MongoDB.batchFindOneById(
        {fieldSet, filter, id},
        Model,
        context,
        (ids: string[]) =>
          this.findManyById({fieldSet, filter, ids}, Model, context)
      )
    }

    logger.debug('findOneById: %s', id, {model: Model.base$handle})

    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const encodedId = this.encodeObjectId(id)
    const options = {
      projection: this.getProjectionFromFieldSet(fieldSet),
    }
    const query = new QueryFilter({_id: encodedId}, '$').intersectWith(filter)
    const result = await connection
      .db(this.dbName)
      .collection(collectionName)
      .findOne(query.toObject({operatorPrefix: '$'}), options)
    const decodedResult = this.encodeAndDecodeObjectIdsInEntry(
      result,
      Model,
      'decode'
    )

    return decodedResult
  }

  getIndexName(index: MongoIndex) {
    const hash = generateHash(JSON.stringify(index))
    const nameNodes = Object.keys(index.fields).reduce(
      (nodes, fieldName) =>
        nodes.concat(`${fieldName}_${index.fields[fieldName]}`),
      []
    )
    const name = `base$${hash}$${nameNodes.join('_')}`.slice(
      0,
      MAX_INDEX_LENGTH
    )

    return name
  }

  async search(
    {
      fieldSet,
      filter,
      pageNumber = 1,
      pageSize,
      text,
    }: DataConnector.SearchParameters,
    Model: typeof BaseModel,
    context?: Context,
    cache = true
  ) {
    if (cache && context) {
      const parameters = {fieldSet, filter, pageNumber, pageSize, text}

      return context.getFromCacheOrOrigin<DataConnector.SearchReturnValue>(
        () => this.search(parameters, Model, context, false),
        JSON.stringify(parameters)
      )
    }

    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const options: Record<string, any> = {
      projection: {
        ...this.getProjectionFromFieldSet(fieldSet),
        _searchScore: {$meta: 'textScore'},
      },
      sort: {_searchScore: {$meta: 'textScore'}},
    }

    if (pageSize) {
      options.limit = pageSize
      options.skip = (pageNumber - 1) * pageSize
    }

    const query = filter ? this.encodeQuery(filter, Model) : {}

    options._searchScore = {$meta: 'textScore'}
    query.$text = {$search: text, $diacriticSensitive: true}

    logger.debug('search: %o', query, {
      model: Model.base$handle,
    })

    const cursor = await connection
      .db(this.dbName)
      .collection(collectionName)
      .find(query, options)
    const count = await cursor.count()
    const results = await cursor.toArray()
    const scores: number[] = []
    const decodedResults: DataConnector.Results = results.map(
      (result: DataConnector.Result) => {
        const {_searchScore, ...fields} = result

        scores.push(_searchScore)

        return this.encodeAndDecodeObjectIdsInEntry(fields, Model, 'decode')
      }
    )

    return {count, results: decodedResults, scores}
  }

  async sync(Model: typeof BaseModel) {
    logger.debug('Syncinc model %s', Model.base$handle)

    const {fieldIndexes, schemaIndexes, searchIndexes} = Model.base$schema
    const newIndexes: Map<string, MongoIndex> = new Map()

    fieldIndexes.concat(schemaIndexes).forEach((index) => {
      const newIndex: MongoIndex = {
        fields: index.fields,
        options: {},
      }

      if (index.sparse === true) {
        newIndex.options.sparse = index.sparse
      }

      if (index.unique === true) {
        newIndex.options.unique = index.unique
      }

      const name = this.getIndexName(newIndex)

      newIndexes.set(name, newIndex)
    })

    if (searchIndexes.length > 0) {
      const fields: Record<string, 'text'> = {}
      const weights: Record<string, number> = {}

      searchIndexes.forEach((searchIndex) => {
        const dotPath = searchIndex.fieldPath.join('.')

        fields[dotPath] = 'text'
        weights[dotPath] = searchIndex.weight
      })

      const newIndex: MongoIndex = {
        fields,
        options: {
          weights,
        },
      }
      const name = this.getIndexName(newIndex)

      newIndexes.set(name, newIndex)
    }

    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)

    try {
      const collection = await connection
        .db(this.dbName)
        .createCollection(collectionName)
      const existingIndexes = await collection.listIndexes().toArray()

      await Promise.all(
        existingIndexes.map((rawIndex: any) => {
          // Not touching any indexes that were not created by Baseplate.
          if (!rawIndex.name.startsWith('base$')) {
            return
          }

          // If an existing index is also in the `newIndexes` object, it means
          // the index still stay unaltered. We simply need to remove the index
          // from `newIndexes` so that we don't try to create it again.
          if (newIndexes.get(rawIndex.name)) {
            newIndexes.delete(rawIndex.name)

            return
          }

          // If an existing index doesn't exist in the `newIndexes` object, it
          // means it has been deleted from the schema and therefore we have to
          // drop it from the database.
          logger.debug('Dropped index: %s', rawIndex.name)

          return collection.dropIndex(rawIndex.name)
        })
      )

      await Promise.all(
        Array.from(newIndexes.entries()).map(async ([hash, index]) => {
          try {
            const options = {
              ...index.options,
              name: hash,
            }

            await collection.createIndex(index.fields, options)

            logger.debug('Created index: %o (%o)', index.fields, options)
          } catch (error) {
            logger.error(error)
          }
        })
      )
    } catch (error) {
      if (error.codeName === 'NamespaceExists') {
        logger.debug(error)
      } else {
        logger.error(error)
      }
    }
  }

  async update(
    filter: QueryFilter,
    update: Record<string, any>,
    Model: typeof BaseModel,
    context: Context
  ) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)
    const query = filter ? this.encodeQuery(filter, Model) : {}

    try {
      const cursor = await connection
        .db(this.dbName)
        .collection(collectionName)
        .find(query, {projection: {_id: 1}})
      const results = await cursor.toArray()
      const ids = results.map((result) => this.decodeObjectId(result._id))

      await connection
        .db(this.dbName)
        .collection(collectionName)
        .updateMany(query, {$set: update})

      const updatedResults = await this.findManyById({ids}, Model, context)

      return {
        results: updatedResults,
      }
    } catch (error) {
      if (error.code === 11000) {
        throw new errors.UniqueConstraintViolatedError()
      }

      throw error
    }
  }

  async updateOneById(
    id: string,
    update: Record<string, any>,
    Model: typeof BaseModel
  ) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)

    try {
      const encodedId = this.encodeObjectId(id)
      const {value} = await connection
        .db(this.dbName)
        .collection(collectionName)
        .findOneAndUpdate(
          {_id: encodedId},
          {$set: update},
          {returnOriginal: false}
        )

      return this.encodeAndDecodeObjectIdsInEntry(value, Model, 'decode')
    } catch (error) {
      if (error.code === 11000) {
        throw new errors.UniqueConstraintViolatedError()
      }

      throw error
    }
  }

  async wipe(Model: typeof BaseModel) {
    const connection = await this.connect()
    const collectionName = this.getCollectionName(Model)

    await connection.db(this.dbName).collection(collectionName).deleteMany({})
  }
}
