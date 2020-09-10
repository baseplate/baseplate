import {CustomError} from '@baseplate/schema'

import {
  ForbiddenError,
  InvalidQueryParameterError,
  ModelNotFoundError,
} from '../../errors'
import AccessModel from '../../internalModels/access'
import BaseModel from '../../model/base'
import Context from '../../context'
import FieldSet from '../../fieldSet'
import HttpRequest from '../../http/request'
import JsonApiURL from './url'
import type {ModelStore} from '../../modelStore'
import QueryFilter from '../../queryFilter/'
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
  entry: BaseModel
  fieldName: string
  includeMap: IncludeMap
  modelStore: ModelStore
  referencesHash: Record<string, object>
  user: UserModel
}

export type ResolveRelationshipsParameters = {
  entries: Array<BaseModel>
  includeMap?: IncludeMap
  Model: typeof BaseModel
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

  getQueryFilter(operatorPrefix = '$') {
    return new QueryFilter(this.url.getQueryParameter('filter'), operatorPrefix)
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
    const schema = (<typeof BaseModel>entry.constructor).base$schema

    if (!fieldValue || schema.fields[fieldName].type !== 'reference') {
      return null
    }

    const relationshipValue = Array.isArray(fieldValue)
      ? fieldValue
      : [fieldValue]
    const queue = relationshipValue
      .filter(Boolean)
      .map(async (entry: BaseModel) => {
        const Model = <typeof BaseModel>entry.constructor
        const access = await Access.getAccess({
          accessType: 'read',
          context: this.context,
          modelName: Model.base$handle,
          user,
        })

        if (access.toObject() === false) {
          return {
            error: new ForbiddenError(),
          }
        }

        const fieldSet = FieldSet.intersect(
          access.fields,
          this.fields[Model.base$handle]
        )
        const filter = new QueryFilter({_id: entry.id}).intersectWith(
          access.filter
        )
        const referencedEntry = await Model.findOne({
          context: this.context,
          fieldSet,
          filter,
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
          entry: referencedEntry,
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
      const schema = (<typeof Model>entry.constructor).base$schema

      Object.keys(includeMap).forEach((fieldName) => {
        if (schema.fields[fieldName].type !== 'reference') {
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
          }).then((relationship) => {
            const normalizedRelationship = Array.isArray(relationship)
              ? relationship
              : [relationship]
            const relationshipErrors = normalizedRelationship.reduce(
              (errors, relationship) =>
                relationship.error ? errors.concat(relationship.error) : errors,
              []
            )

            if (relationshipErrors.length > 0) {
              errors[fieldName] = <CustomError>new Error()
              errors[fieldName].childErrors = relationshipErrors
            }

            return relationship
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
