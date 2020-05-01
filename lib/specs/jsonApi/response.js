class JsonApiResponse {
  constructor({
    entries,
    errors,
    fieldSet,
    includedReferences,
    includeTopLevelLinks = false,
    relationships,
    statusCode = 200,
    totalPages,
    url
  }) {
    this.entries = entries
    this.includedReferences = includedReferences || []
    this.includeTopLevelLinks = includeTopLevelLinks
    this.totalPages = totalPages
    this.relationships = relationships
    this.topLevelFieldSet = fieldSet
    this.url = url

    if (errors) {
      this.errors = Array.isArray(errors) ? errors : [errors]
    }

    this.statusCode = statusCode
  }

  static buildErrorResponse(errors) {
    return {
      errors: errors.reduce((result, error) => {
        return result.concat(this.formatError(error))
      }, [])
    }
  }

  static toObject(props) {
    const response = new this(props)

    return response.toObject()
  }

  async buildSuccessResponse() {
    const meta = {}
    const response = {}

    if (this.entries) {
      if (Array.isArray(this.entries)) {
        meta.count = this.entries.length
      }

      const entriesArray = Array.isArray(this.entries)
        ? this.entries
        : [this.entries]

      try {
        const formattedEntries = await Promise.all(
          entriesArray.map(entry =>
            this.formatEntry(entry, this.topLevelFieldSet)
          )
        )

        response.data = Array.isArray(this.entries)
          ? formattedEntries
          : formattedEntries[0]
      } catch (error) {
        this.errors = [error]

        return this.buildErrorResponse()
      }
    } else if (this.relationships) {
      const relationshipsArray = Array.isArray(this.relationships)
        ? this.relationships
        : [this.relationships]
      const formattedRelationships = relationshipsArray.map(entry =>
        this.formatRelationshipObject({
          _id: entry.id,
          _type: entry.constructor.name
        })
      )

      response.data = Array.isArray(this.relationships)
        ? formattedRelationships
        : formattedRelationships[0]
    }

    if (this.includedReferences.length > 0) {
      response.included = await Promise.all(
        this.includedReferences.map(referenceValue => {
          if (Array.isArray(referenceValue)) {
            return Promise.all(
              referenceValue.map(referenceMember =>
                this.formatEntry(
                  referenceMember.entry,
                  referenceMember.fieldSet
                )
              )
            )
          }

          return this.formatEntry(referenceValue.entry, referenceValue.fieldSet)
        })
      )
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

  async format() {
    const responseBody = this.errors
      ? await this.constructor.buildErrorResponse(this.errors)
      : await this.buildSuccessResponse()
    const isEmptyResponse = Object.keys(responseBody).length === 0

    if (isEmptyResponse) {
      this.statusCode = 204

      return null
    }

    return {
      ...responseBody,
      jsonapi: {
        version: '1.0'
      }
    }
  }

  async formatEntry(entry, fieldSet) {
    const fields = await entry.toObject({
      fieldSet
    })
    const attributes = {}
    const meta = {}
    const relationships = {}

    Object.entries(fields).forEach(([name, value]) => {
      if (name === '_id') {
        return
      }

      if (name[0] === '_') {
        meta[name.substring(1)] = value

        return
      }

      if (entry.constructor.schema.isReferenceField(name)) {
        const links = this.getRelationshipLinksBlock({name, entry})
        const data = Array.isArray(value)
          ? value.map(this.formatRelationshipObject)
          : this.formatRelationshipObject(value)

        relationships[name] = {data, links}
      } else {
        attributes[name] = value
      }
    })

    const formattedEntry = {
      type: entry.constructor.name,
      id: entry.id
    }
    const hasMeta = Boolean(
      Object.values(meta).filter(value => value !== undefined).length
    )

    if (hasMeta) {
      formattedEntry.meta = meta
    }

    if (Object.keys(attributes).length > 0) {
      formattedEntry.attributes = attributes
    }

    if (Object.keys(relationships).length > 0) {
      formattedEntry.relationships = relationships
    }

    if (entry.id && Array.isArray(this.entries)) {
      formattedEntry.links = {
        self: `${this.url.path}/${entry.id}`
      }
    }

    return formattedEntry
  }

  static formatError(error) {
    if (error.childErrors) {
      return error.childErrors.reduce(
        (acc, childError) => acc.concat(this.formatError(childError)),
        []
      )
    }

    const formattedError = {}

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
        pointer: `/data/attributes/${error.path.join('/')}`
      }
    }

    return formattedError
  }

  formatRelationshipObject(object) {
    const result = {
      type: object._type,
      id: object._id
    }

    return result
  }

  getLinksBlock() {
    const links = {
      self: this.url.format()
    }

    if (this.totalPages > 1) {
      links.first = this.url.format({overrideParameters: {'page[number]': 1}})
      links.last = this.url.format({
        overrideParameters: {'page[number]': this.totalPages}
      })

      const currentPage = (this.url.getQueryParameter('page') || {}).number || 1

      if (currentPage > 1) {
        links.prev = this.url.format({
          overrideParameters: {'page[number]': currentPage - 1}
        })
      }

      if (currentPage < this.totalPages) {
        links.next = this.url.format({
          overrideParameters: {'page[number]': currentPage + 1}
        })
      }
    }

    return links
  }

  getRelationshipLinksBlock({entry, fieldName}) {
    const self = this.url.format({
      overrideParameters: null,
      overridePath: [this.url.path, entry.id, 'relationships', fieldName].join(
        '/'
      )
    })
    const related = this.url.format({
      overrideParameters: null,
      overridePath: [this.url.path, entry.id, fieldName].join('/')
    })

    return {self, related}
  }

  async toObject() {
    const body = await this.format()

    return {
      body,
      statusCode:
        body && body.errors ? body.errors[0].status || 500 : this.statusCode
    }
  }
}

module.exports = JsonApiResponse
