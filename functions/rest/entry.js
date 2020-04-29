const {
  EntryNotFoundError,
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../lib/errors')
const FieldSet = require('../../lib/fieldSet')
const JsonApiRequest = require('../../lib/specs/jsonApi/request')
const JsonApiResponse = require('../../lib/specs/jsonApi/response')
const modelFactory = require('../../lib/modelFactory')
const schemaStore = require('../../lib/schemaStore')

module.exports.delete = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName, true)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(schema.name, schema, {
      datastore: context.datastore
    })
    const access = await Model.getAccessForUser({
      accessType: 'delete',
      user: context.user
    })

    if (access.isDenied()) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const id = req.url.getPathParameter('id')
    const {deleteCount} = await Model.delete({id})

    if (deleteCount === 0) {
      throw new EntryNotFoundError({id})
    }

    const {body, statusCode} = await JsonApiResponse.toObject({
      statusCode: 200,
      url: req.url
    })

    res.status(statusCode).json(body)
  } catch (errors) {
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      request: this,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}

module.exports.get = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName, true)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(schema.name, schema, {
      datastore: context.datastore
    })
    const access = await Model.getAccessForUser({
      accessType: 'read',
      user: context.user
    })

    if (access.isDenied()) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const id = req.url.getPathParameter('id')
    const urlFields =
      req.url.getQueryParameter('fields', {
        isCSV: true
      }) || {}
    const fieldSet = FieldSet.intersect(access.fields, urlFields[schema.name])
    const entry = await Model.findOneById({
      fieldSet,
      filter: access.filter,
      id
    })

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const request = new JsonApiRequest(req, context)

    await request.resolveReferences({
      entries: [entry],
      fieldSets: urlFields,
      includeMap: req.url.getQueryParameter('include', {
        isCSV: true,
        isDotPath: true
      })
    })

    const {body, statusCode} = await JsonApiResponse.toObject({
      entries: entry,
      fieldSet,
      includedReferences: Object.values(request.references),
      includeTopLevelLinks: true,
      url: req.url
    })

    res.status(statusCode).json(body)
  } catch (errors) {
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}

module.exports.patch = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const schema = schemaStore.get(modelName, true)

    if (!schema) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Model = modelFactory(schema.name, schema, {
      datastore: context.datastore
    })
    const access = await Model.getAccessForUser({
      accessType: 'update',
      user: context.user
    })

    if (access.isDenied()) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const id = req.url.getPathParameter('id')
    const request = new JsonApiRequest(req, context)
    const update = await request.getEntryFieldsFromBody()
    const entry = await Model.update({id, update})

    await request.resolveReferences({
      entries: [entry],
      includeMap: req.url.getQueryParameter('include')
    })

    const {body, statusCode} = await JsonApiResponse.toObject({
      entries: entry,
      includedReferences: Object.values(request.references),
      includeTopLevelLinks: true,
      url: req.url
    })

    res.status(statusCode).json(body)
  } catch (errors) {
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}
