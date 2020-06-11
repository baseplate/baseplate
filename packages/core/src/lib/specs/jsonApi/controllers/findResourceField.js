const {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError,
} = require('../../../errors')
const JsonApiRequest = require('../request')
const JsonApiResponse = require('../response')
const modelStore = require('../../../modelStore/')

module.exports = async (req, res, context) => {
  try {
    const modelName = req.params.modelName
    const Model = modelStore.getByPluralForm(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Access = modelStore.get('base_access')
    const access = await Access.getAccess({
      accessType: 'read',
      context,
      modelName: Model.handle,
      user: context.user,
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const jsonApiReq = new JsonApiRequest(req, context)
    const {fieldName, id} = jsonApiReq.params

    if (
      !Model.schema.fields[fieldName] ||
      (access.fields && !access.fields.includes(fieldName))
    ) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.handle})
    }

    const entry = await Model.findOneById({context, id})

    if (!entry || !entry.get(fieldName)) {
      throw new EntryNotFoundError({id})
    }

    const hasMultipleReferences = Array.isArray(entry.get(fieldName))
    const references = await jsonApiReq.resolveReferences({
      entries: [entry],
      includeMap: {
        [fieldName]: true,
      },
      Model,
    })
    const fieldValue = Object.values(references).map(({entry}) => entry)
    const childReferences = await jsonApiReq.resolveReferences({
      entries: fieldValue,
      Model,
    })
    const jsonApiRes = new JsonApiResponse({
      entries: hasMultipleReferences ? fieldValue : fieldValue[0],
      includedReferences: Object.values(childReferences),
      includeTopLevelLinks: true,
      res,
      url: jsonApiReq.url,
    })

    jsonApiRes.end()
  } catch (errors) {
    const jsonApiRes = new JsonApiResponse({
      errors,
      res,
      url: req.url,
    })

    jsonApiRes.end()
  }
}
