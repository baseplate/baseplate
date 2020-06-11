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
    const {id, fieldName} = jsonApiReq.params

    if (
      !Model.schema.fields[fieldName] ||
      (access.fields && !access.fields.includes(fieldName))
    ) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.handle})
    }

    const entry = await Model.findOneById({context, id})

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const fieldValue = entry.get(fieldName)
    const isReferenceArray = Array.isArray(fieldValue)
    const referenceArray = isReferenceArray ? fieldValue : [fieldValue]
    const referenceEntries = referenceArray.map(({id, type}) => {
      const ReferenceModel = Model.store.get(type)

      return new ReferenceModel({_id: id})
    })
    const jsonApiRes = new JsonApiResponse({
      includeTopLevelLinks: true,
      relationships: isReferenceArray ? referenceEntries : referenceEntries[0],
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
