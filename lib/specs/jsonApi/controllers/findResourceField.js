const {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError
} = require('../../../errors')
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

    const fieldName = req.url.getPathParameter('fieldName')

    if (
      !Model.schema.fields[fieldName] ||
      (access.fields && !access.fields.includes(fieldName))
    ) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.name})
    }

    const id = req.url.getPathParameter('id')
    const entry = await Model.findOneById({id})

    if (!entry || !entry.get(fieldName)) {
      throw new EntryNotFoundError({id})
    }

    const hasMultipleReferences = Array.isArray(entry.get(fieldName))
    const jsonApiReq = new JsonApiRequest({context, Model, req})

    await jsonApiReq.resolveReferences([entry], {[fieldName]: true})

    const fieldValue = Object.values(jsonApiReq.references).map(
      ({entry}) => entry
    )

    await jsonApiReq.resolveReferences(fieldValue)

    const {body, statusCode} = await JsonApiResponse.toObject({
      entries: hasMultipleReferences ? fieldValue : fieldValue[0],
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
