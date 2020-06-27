import {CustomError} from '@baseplate/validator'

import {FieldSetType} from '../../fieldSet'
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
  entries?: JsonApiModel | Array<JsonApiModel>
  errors?: Array<CustomError>
  fieldSet?: FieldSetType
  includedReferences?: Array<IncludedRelationship>
  includeTopLevelLinks?: boolean
  pageSize?: number
  relationships?: RelationshipData | Array<RelationshipData>
  res: HttpResponse
  statusCode?: number
  totalEntries?: number
  totalPages?: number
  url: JsonApiURL
}

export default class JsonApiResponse {
  entries: JsonApiModel | Array<JsonApiModel>
  errors: Array<CustomError>
  includedReferences: Array<IncludedRelationship>
  includeTopLevelLinks: boolean
  pageSize: number
  relationships: RelationshipData | Array<RelationshipData>
  res: HttpResponse
  topLevelFieldSet: FieldSetType
  totalEntries: number
  totalPages: number
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
          entriesArray.map((entry) =>
            this.formatEntry(entry, this.topLevelFieldSet)
          )
        )

        response.data = Array.isArray(this.entries)
          ? formattedEntries
          : formattedEntries[0]
      } catch (error) {
        return (<typeof JsonApiResponse>this.constructor).buildErrorResponse([
          error,
        ])
      }
    } else if (this.relationships) {
      const relationshipsArray = Array.isArray(this.relationships)
        ? this.relationships
        : [this.relationships]
      const formattedRelationships = relationshipsArray.map((entry) =>
        this.formatRelationshipObject({
          id: entry.id,
          type: (<typeof JsonApiModel>entry.constructor).handle,
        })
      )

      response.data = Array.isArray(this.relationships)
        ? formattedRelationships
        : formattedRelationships[0]
    }

    if (this.includedReferences.length > 0) {
      response.included = await Promise.all(
        this.includedReferences.map((a) => {
          return this.formatEntry(a.entry)
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

  async formatEntry(entry: JsonApiModel, fieldSet?: FieldSetType) {
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

      if (
        (<typeof JsonApiModel>entry.constructor).schema.isReferenceField(name)
      ) {
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
      type: (<typeof JsonApiModel>entry.constructor).handle,
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

    if (typeof entry.$__jsonApiPostFormat === 'function') {
      return entry.$__jsonApiPostFormat(formattedEntry, entry)
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

  formatRelationshipObject(object: RelationshipData) {
    const result = {
      type: object.type,
      id: object.id,
    }

    return result
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

  getRelationshipLinksBlock(entry: JsonApiModel, name: string) {
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

  async end() {
    const {body, statusCode} = await this.toObject()

    this.res.status(statusCode).json(body, 'application/vnd.api+json')
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
