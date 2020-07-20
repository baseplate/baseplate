import {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError,
} from '../../../errors'
import Context from '../../../context'
import HttpRequest from '../../../http/request'
import HttpResponse from '../../../http/response'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'
import modelStore from '../../../modelStore/'
import {RelationshipData} from '../relationship'

export default async function (
  req: HttpRequest,
  res: HttpResponse,
  context: Context
) {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const modelName = req.params.modelName
    const Model = modelStore.getByPluralForm(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const access = await Model.base$authenticate({
      accessType: 'read',
      context,
      user: context.get('base$user'),
    })

    if (access.toObject() === false) {
      throw context.get('base$user')
        ? new ForbiddenError()
        : new UnauthorizedError()
    }

    const {id, fieldName} = jsonApiReq.params

    if (
      !Model.base$schema.fields[fieldName] ||
      (access.fields && !access.fields.has(fieldName))
    ) {
      throw new EntryFieldNotFoundError({
        fieldName,
        modelName: Model.base$handle,
      })
    }

    const entry = await Model.findOneById({context, id})

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const fieldValue = entry.get(fieldName)
    const isReferenceArray = Array.isArray(fieldValue)
    const referenceArray = isReferenceArray ? fieldValue : [fieldValue]
    const referenceEntries = referenceArray.map(
      ({id, type}: RelationshipData) => {
        const ReferenceModel = Model.base$modelStore.get(type)

        return new ReferenceModel({_id: id})
      }
    )
    const jsonApiRes = new JsonApiResponse({
      includeTopLevelLinks: true,
      relationships: isReferenceArray ? referenceEntries : referenceEntries[0],
      res,
      url: jsonApiReq.url,
    })

    return jsonApiRes.end()
  } catch (errors) {
    const jsonApiRes = new JsonApiResponse({
      errors,
      res,
      url: jsonApiReq.url,
    })

    return jsonApiRes.end()
  }
}
