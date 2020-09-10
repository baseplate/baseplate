import {CustomError} from '@baseplate/schema'

import BaseModel from '../../model/base'
import FieldSet from '../../fieldSet'
import {
  IncludedRelationship,
  Relationship,
  RelationshipData,
} from './relationship'
import HttpResponse from '../../http/response'
import JsonApiEntry, {LinksBlock, MetaBlock} from './entry'
import JsonApiError from './error'
import JsonApiURL from './url'
import JsonApiModel from './model'
import logger from '../../logger'

interface JsonApiResponseBody {
  data?: JsonApiEntry | Array<JsonApiEntry>
  errors?: Array<JsonApiError>
  included?: Array<JsonApiEntry>
  jsonapi: {
    version: string
  }
  links?: LinksBlock
  meta?: MetaBlock
}

interface JsonApiResponseConstructorParameters {
  entries?: BaseModel | Array<BaseModel>
  errors?: Array<CustomError>
  fieldSet?: FieldSet
  includedReferences?: Array<IncludedRelationship>
  includeTopLevelLinks?: boolean
  pageSize?: number
  relationships?: BaseModel | Array<BaseModel>
  res: HttpResponse
  searchScores?: number[]
  statusCode?: number
  totalEntries?: number
  totalPages?: number
  url: JsonApiURL
}

export default class JsonApiResponse {
  entries: BaseModel | Array<BaseModel>
  errors: Array<CustomError>
  includedReferences: Array<IncludedRelationship>
  includeTopLevelLinks: boolean
  pageSize: number
  relationships: BaseModel | Array<BaseModel>
  res: HttpResponse
  topLevelFieldSet: FieldSet
  totalEntries: number
  totalPages: number
  searchScores: number[]
  statusCode: number
  url: JsonApiURL

  constructor({
    entries,
    errors,
    fieldSet,
    includedReferences,
    includeTopLevelLinks = false,
    pageSize,
    relationships,
    res,
    searchScores,
    statusCode = 200,
    totalEntries,
    totalPages,
    url,
  }: JsonApiResponseConstructorParameters) {
    this.entries = entries
    this.includedReferences = includedReferences || []
    this.includeTopLevelLinks = includeTopLevelLinks
    this.pageSize = pageSize
    this.relationships = relationships
    this.res = res
    this.searchScores = searchScores
    this.topLevelFieldSet = fieldSet
    this.totalEntries = totalEntries
    this.totalPages = totalPages
    this.url = url

    if (errors) {
      this.errors = Array.isArray(errors) ? errors : [errors]
    }

    this.statusCode = statusCode
  }

  static buildErrorResponse(errors: Array<CustomError>) {
    return {
      errors: errors.reduce((result, error) => {
        return result.concat(this.formatError(error))
      }, []),
    }
  }

  static toObject(props: JsonApiResponseConstructorParameters) {
    const response = new this(props)

    return response.toObject()
  }

  async buildSuccessResponse() {
    const meta: MetaBlock = {}
    const response: Omit<JsonApiResponseBody, 'jsonapi'> = {}

    if (this.entries) {
      meta.count = this.totalEntries

      const entriesArray = Array.isArray(this.entries)
        ? this.entries
        : [this.entries]

      try {
        const formattedEntries = await Promise.all(
          entriesArray.map((entry, index) =>
            this.formatEntry(entry, {
              fieldSet: this.topLevelFieldSet,
              searchScore: this.searchScores && this.searchScores[index],
            })
          )
        )

        response.data = Array.isArray(this.entries)
          ? formattedEntries
          : formattedEntries[0]
      } catch (error) {
        this.errors = this.errors || []
        this.errors.push(error)

        return (<typeof JsonApiResponse>this.constructor).buildErrorResponse([
          error,
        ])
      }
    } else if (this.relationships) {
      const relationshipsArray = Array.isArray(this.relationships)
        ? this.relationships
        : [this.relationships]
      const formattedRelationships = relationshipsArray.map(
        this.formatRelationshipObject
      )

      response.data = Array.isArray(this.relationships)
        ? formattedRelationships
        : formattedRelationships[0]
    }

    if (this.includedReferences.length > 0) {
      response.included = await Promise.all(
        this.includedReferences.map((reference) => {
          return this.formatEntry(reference.entry)
        })
      )
    }

    if (typeof this.pageSize === 'number') {
      meta.pageSize = this.pageSize
    }

    if (typeof this.totalPages === 'number') {
      meta.totalPages = this.totalPages
    }

    if (Object.keys(meta).length) {
      response.meta = meta
    }

    if (this.includeTopLevelLinks) {
      response.links = this.getLinksBlock()
    }

    return response
  }

  async format(): Promise<JsonApiResponseBody> {
    const responseBody = this.errors
      ? await (<typeof JsonApiResponse>this.constructor).buildErrorResponse(
          this.errors
        )
      : await this.buildSuccessResponse()
    const isEmptyResponse = Object.keys(responseBody).length === 0

    if (isEmptyResponse) {
      this.statusCode = 204

      return null
    }

    return {
      ...responseBody,
      jsonapi: {
        version: '1.0',
      },
    }
  }

  async formatEntry(
    entry: BaseModel,
    {fieldSet, searchScore}: {fieldSet?: FieldSet; searchScore?: number} = {}
  ) {
    const fields = await entry.toObject({
      fieldSet,
    })
    const attributes: Record<string, any> = {}
    const meta: MetaBlock = {}
    const relationships: Record<string, Relationship> = {}

    Object.entries(fields).forEach(([name, value]) => {
      if (name === '_id') {
        return
      }

      if (name[0] === '_') {
        meta[name.substring(1)] = value

        return
      }

      const schema = (<typeof BaseModel>entry.constructor).base$schema

      if (schema.virtuals[name]) {
        attributes[name] = value

        return
      }

      if (schema.fields[name].type === 'reference') {
        const links = this.getRelationshipLinksBlock(entry, name)
        const data = Array.isArray(value)
          ? value.map(this.formatRelationshipObject)
          : this.formatRelationshipObject(value)

        relationships[name] = {data, links}
      } else {
        attributes[name] = value
      }
    })

    const formattedEntry: JsonApiEntry = {
      type: (<typeof BaseModel>entry.constructor).base$handle,
      id: entry.id,
      attributes,
    }
    const hasMeta = Boolean(
      Object.values(meta).filter((value) => value !== undefined).length
    )

    if (hasMeta) {
      formattedEntry.meta = meta
    }

    if (Object.keys(relationships).length > 0) {
      formattedEntry.relationships = relationships
    }

    if (entry.id && Array.isArray(this.entries)) {
      formattedEntry.links = {
        self: `${this.url.path}/${entry.id}`,
      }
    }

    if (typeof searchScore === 'number') {
      formattedEntry.meta.searchScore = searchScore
    }

    const jsonApiEntry = <JsonApiModel>entry

    if (typeof jsonApiEntry.base$jsonApiFormat === 'function') {
      return jsonApiEntry.base$jsonApiFormat(formattedEntry, entry)
    }

    return formattedEntry
  }

  static formatError(error: CustomError): JsonApiError | Array<JsonApiError> {
    if (error.childErrors) {
      return error.childErrors.reduce(
        (acc: Array<JsonApiError>, childError: CustomError) =>
          acc.concat(this.formatError(childError)),
        []
      )
    }

    const formattedError: JsonApiError = {}

    if (error.statusCode) {
      formattedError.status = error.statusCode
    }

    if (error.message) {
      formattedError.title = error.message
    }

    if (error.detail) {
      formattedError.detail = error.detail
    }

    if (error.path) {
      formattedError.source = {
        pointer: `/data/attributes/${error.path.join('/')}`,
      }
    }

    return formattedError
  }

  async end() {
    const {body, statusCode} = await this.toObject()

    if (this.errors) {
      this.errors.forEach((error) => {
        if (!(error instanceof CustomError)) {
          logger.error(error)
        }
      })
    }

    return this.res.status(statusCode).json(body, 'application/vnd.api+json')
  }

  formatRelationshipObject(entry: BaseModel) {
    return {
      type: (<typeof BaseModel>entry.constructor).base$handle,
      id: entry.id,
    }
  }

  getLinksBlock() {
    const links: LinksBlock = {
      self: this.url.format(),
    }

    if (this.totalPages > 1) {
      links.first = this.url.format({overrideParameters: {'page[number]': 1}})
      links.last = this.url.format({
        overrideParameters: {'page[number]': this.totalPages},
      })

      const currentPage = (this.url.getQueryParameter('page') || {}).number || 1

      if (currentPage > 1) {
        links.prev = this.url.format({
          overrideParameters: {'page[number]': currentPage - 1},
        })
      }

      if (currentPage < this.totalPages) {
        links.next = this.url.format({
          overrideParameters: {'page[number]': currentPage + 1},
        })
      }
    }

    return links
  }

  getRelationshipLinksBlock(entry: BaseModel, name: string) {
    const self = this.url.format({
      overrideParameters: null,
      overridePath: [this.url.path, entry.id, 'relationships', name].join('/'),
    })
    const related = this.url.format({
      overrideParameters: null,
      overridePath: [this.url.path, entry.id, name].join('/'),
    })

    return {self, related}
  }

  async toObject() {
    const body = await this.format()

    return {
      body,
      statusCode:
        body && body.errors ? body.errors[0].status || 500 : this.statusCode,
    }
  }
}
