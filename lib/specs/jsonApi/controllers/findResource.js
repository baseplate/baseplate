const {
  EntryNotFoundError,
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../../errors')
const FieldSet = require('../../../fieldSet')
const JsonApiRequest = require('../request')
const JsonApiResponse = require('../response')
const modelStore = require('../../../modelStore/')

module.exports = async (req, res, context) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const Model = modelStore.get(modelName, {context, isPlural: true})

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

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
    const fieldSet = FieldSet.intersect(
      access.fields,
      urlFields[Model.schema.name]
    )
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
