import {CustomError} from '@baseplate/validator'

import {InvalidQueryParameterError} from '../../errors'
import AccessModel from '../../internalModels/access'
import Context from '../../context'
import FieldSet from '../../fieldSet'
import GenericModel from '../../model/base'
import HttpRequest from '../../http/request'
import JsonApiModel from './model'
import JsonApiURL from './url'
import type {ModelStore} from '../../modelStore'
import QueryFilter from '../../queryFilter'
import {
  IncludedRelationship,
  IncludeMap,
  RelationshipData,
} from './relationship'
import SortObject from '../../sortObject'
import UserModel from '../../internalModels/user'

interface JsonApiRequestBody {
  data: {
    attributes: Record<string, any>
    relationships: Record<string, any>
  }
}

export type ResolveRelationshipParameters = {
  Access: typeof AccessModel
  entry: GenericModel
  fieldName: string
  includeMap: IncludeMap
  modelStore: ModelStore
  referencesHash: Record<string, object>
  user: UserModel
}

export type ResolveRelationshipsParameters = {
  entries: Array<JsonApiModel>
  includeMap?: IncludeMap
  Model: typeof GenericModel
  user: UserModel
}

export default class JsonApiRequest {
  bodyFields: Record<string, any>
  context: Context
  fields: Record<string, FieldSet>
  filter: QueryFilter
  includeMap: IncludeMap
  pageNumber: number
  pageSize: number
  params: HttpRequest['params']
  sort: SortObject
  url: JsonApiURL

  constructor(req: HttpRequest, context: Context) {
    this.bodyFields = this.getEntryFieldsFromBody(<JsonApiRequestBody>req.body)
    this.context = context
    this.params = req.params

    const url = new JsonApiURL(req.url)
    const fields = this.createFieldSet(url.getQueryParameter('fields') || {})
    const {number: pageNumber, size: pageSize} =
      url.getQueryParameter('page') || {}
    const includeMap = url.getQueryParameter('include')
    const sort = url.getQueryParameter('sort') || []
    const sortObject = sort.reduce(
      (sortObject: SortObject, expression: string) => {
        if (expression[0] === '-' || expression[0] === '+') {
          const sortValue = expression[0] === '-' ? -1 : 1

          return {
            ...sortObject,
            [expression.slice(1)]: sortValue,
          }
        }

        return {
          ...sortObject,
          [expression]: 1,
        }
      },
      undefined
    )

    this.fields = fields
    this.filter = url.getQueryParameter('filter')
    this.includeMap = includeMap || {}
    this.pageNumber = pageNumber
    this.pageSize = pageSize
    this.sort = sortObject
    this.url = url
  }

  castRelationshipObject(object: RelationshipData) {
    const result = {
      id: object.id,
      type: object.type,
    }

    return result
  }

  createFieldSet(parameters: Record<string, string[]>) {
    return Object.keys(parameters).reduce(
      (fieldSets, modelName) => ({
        ...fieldSets,
        [modelName]: new FieldSet(parameters[modelName]),
      }),
      {}
    )
  }

  getEntryFieldsFromBody(body: JsonApiRequestBody) {
    if (!body) {
      return {}
    }

    const {attributes = {}, relationships = {}} = body.data || {}
    const fields = {...attributes}

    Object.keys(relationships).forEach((fieldName) => {
      if (!relationships[fieldName]) {
        return null
      }

      const {data} = relationships[fieldName]

      fields[fieldName] = Array.isArray(data)
        ? data.map(this.castRelationshipObject)
        : this.castRelationshipObject(data)
    })

    return fields
  }

  // Takes an entry, a name of a relationship and an include map. Fetches the
  // corresponding entries from the referenced models.
  // An include map is an object that specifies what relationships to resolve,
  // on a recursive fashion.
  //
  // Example:
  // { "books": { "author": true, "genre": { "parentGenre": true } } }
  //
  // Depending on whether the relationship contains one or multiple values, the
  // return value of this method will contain an object or an array of objects,
  // of type `IncludedRelationship`, containing two properties:
  //
  // - entry: The referenced entry
  // - fieldSet: The fieldset requested for the relationship
  async resolveRelationship({
    Access,
    entry,
    fieldName,
    includeMap,
    modelStore,
    referencesHash,
    user,
  }: ResolveRelationshipParameters): Promise<
    IncludedRelationship | Array<IncludedRelationship>
  > {
    const fieldValue = entry.get(fieldName)

    if (
      !fieldValue ||
      !(<typeof GenericModel>entry.constructor).base$schema.isReferenceField(
        fieldName
      )
    ) {
      return null
    }

    const relationshipValue = Array.isArray(fieldValue)
      ? fieldValue
      : [fieldValue]
    const queue = relationshipValue.filter(Boolean).map(async ({id, type}) => {
      const ReferencedModel = modelStore.get(type)

      if (!ReferencedModel) return null

      const access = await Access.getAccess({
        accessType: 'read',
        context: this.context,
        modelName: ReferencedModel.base$handle,
        user,
      })

      if (access.toObject() === false) {
        return null
      }

      const fieldSet = FieldSet.intersect(access.fields, this.fields[type])
      const referencedEntry = await ReferencedModel.findOneById({
        context: this.context,
        fieldSet,
        filter: access.filter,
        id,
        user,
      })

      if (includeMap && typeof includeMap === 'object') {
        const childReferenceQueue = Object.keys(includeMap).map(
          (childFieldName) => {
            return this.resolveRelationship({
              Access,
              entry: referencedEntry,
              fieldName: childFieldName,
              includeMap: includeMap[childFieldName],
              modelStore,
              referencesHash,
              user,
            })
          }
        )

        await Promise.all(childReferenceQueue)
      }

      return {
        fieldSet,
        entry: <JsonApiModel>referencedEntry,
      }
    })
    const includedReferences: Array<IncludedRelationship> = await Promise.all(
      queue
    )

    if (referencesHash) {
      includedReferences
        .filter((reference) => reference.entry)
        .forEach((reference: IncludedRelationship) => {
          referencesHash[reference.entry.id] = reference
        })
    }

    return includedReferences
  }

  async resolveRelationships({
    entries,
    includeMap = this.includeMap,
    Model,
    user,
  }: ResolveRelationshipsParameters): Promise<
    Record<string, IncludedRelationship>
  > {
    const Access = <typeof AccessModel>Model.base$modelStore.get('base$access')
    const referencesHash: Record<string, IncludedRelationship> = {}
    const errors: Record<string, CustomError> = {}
    const queue: Array<Promise<
      IncludedRelationship | IncludedRelationship[]
    >> = []

    entries.forEach((entry) => {
      Object.keys(includeMap).forEach((fieldName) => {
        if (
          !(<typeof Model>entry.constructor).base$schema.isReferenceField(
            fieldName
          )
        ) {
          errors[fieldName] = new InvalidQueryParameterError({
            name: 'include',
            value: fieldName,
          })

          return
        }

        queue.push(
          this.resolveRelationship({
            Access,
            entry,
            fieldName,
            includeMap: includeMap[fieldName],
            modelStore: Model.base$modelStore,
            referencesHash,
            user,
          })
        )
      })
    })

    await Promise.all(queue)

    if (Object.keys(errors).length > 0) {
      const errorWrapper = <CustomError>new Error()

      errorWrapper.childErrors = Object.values(errors)

      throw errorWrapper
    }

    return referencesHash
  }
}
