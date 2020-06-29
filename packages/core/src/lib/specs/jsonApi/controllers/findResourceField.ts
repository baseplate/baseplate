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
import JsonApiModel from '../model'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'
import modelStore from '../../../modelStore/'

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
      user: context.user,
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const {fieldName, id} = jsonApiReq.params

    if (
      !Model.schema.fields[fieldName] ||
      (access.fields && !access.fields.includes(fieldName))
    ) {
      throw new EntryFieldNotFoundError({fieldName, modelName: Model.handle})
    }

    const entry = <JsonApiModel>(
      await Model.findOneById({context, id, user: context.user})
    )

    if (!entry || !entry.get(fieldName)) {
      throw new EntryNotFoundError({id})
    }

    const hasMultipleReferences = Array.isArray(entry.get(fieldName))
    const references = await jsonApiReq.resolveRelationships({
      entries: [entry],
      includeMap: {
        [fieldName]: true,
      },
      Model,
      user: context.user,
    })
    const fieldValue = Object.values(references).map(({entry}) => entry)
    const childReferences = await jsonApiReq.resolveRelationships({
      entries: fieldValue,
      Model,
      user: context.user,
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
      url: jsonApiReq.url,
    })

    jsonApiRes.end()
  }
}
