const {JsonApiResponse} = require('../../lib/specs/jsonApi')
const {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ModelNotFoundError
} = require('../../lib/errors')

module.exports.get = async (req, res, {modelStore}) => {
  try {
    const modelName = req.url.getPathParameter('modelName')
    const Model = modelStore.get(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const fieldName = req.url.getPathParameter('fieldName')

    if (!Model.schema.fields[fieldName]) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.name})
    }

    const id = req.url.getPathParameter('id')
    const entry = await Model.findOneById({id})

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const fieldValue = entry.get(fieldName)
    const isReferenceArray = Array.isArray(fieldValue)
    const referenceArray = isReferenceArray ? fieldValue : [fieldValue]
    const referenceEntries = referenceArray.map(({_id, _type}) => {
      const ReferenceModel = modelStore.get(_type)

      return new ReferenceModel({_id})
    })
    const response = new JsonApiResponse({
      includeTopLevelLinks: true,
      relationships: isReferenceArray ? referenceEntries : referenceEntries[0],
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  } catch (errors) {
    const response = new JsonApiResponse({
      errors,
      url: req.url
    })
    const {body, statusCode} = await response.toObject()

    res.status(statusCode).json(body)
  }
}
