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

    const Access = modelStore.get('base_modelAccess', {context})
    const access = await Access.getAccess({
      accessType: 'read',
      modelName: Model.schema.name,
      user: context.user
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const id = req.url.getPathParameter('id')
    const jsonApiReq = new JsonApiRequest({context, Model, req})
    const fieldSet = FieldSet.intersect(access.fields, jsonApiReq.fieldSet)
    const entry = await Model.findOneById({
      fieldSet,
      filter: access.filter,
      id
    })

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    await jsonApiReq.resolveReferences([entry])

    const {body, statusCode} = await JsonApiResponse.toObject({
      entries: entry,
      fieldSet,
      includedReferences: Object.values(jsonApiReq.references),
      includeTopLevelLinks: true,
      url: req.url
    })

    res.status(statusCode).json(body)
  } catch (errors) {
    console.log(errors)
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}
