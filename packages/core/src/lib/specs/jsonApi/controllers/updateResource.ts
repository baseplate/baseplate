import {ModelNotFoundError} from '../../../errors'
import Context from '../../../context'
import HttpRequest from '../../../http/request'
import HttpResponse from '../../../http/response'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'
import modelStore from '../../../modelStore'

export default async function (
  req: HttpRequest,
  res: HttpResponse,
  context: Context
) {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const {modelName, ...queryParamters} = req.params
    const Model = modelStore.get(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const entry = await Model.updateOneById({
      context,
      id: queryParamters._id, // (!) TO DO: Use Model.update() with a generic filter
      update: jsonApiReq.bodyFields,
      user: context.get('base$user'),
    })
    const references = await jsonApiReq.resolveRelationships({
      entries: [entry],
      Model,
      user: context.get('base$user'),
    })
    const jsonApiRes = new JsonApiResponse({
      entries: entry,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
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
