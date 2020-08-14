import {EntryNotFoundError, ModelNotFoundError} from '../../../errors'
import Context from '../../../context'
import HttpRequest from '../../../http/request'
import HttpResponse from '../../../http/response'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'
import modelStore from '../../../modelStore'
import QueryFilter from '../../../queryFilter/'

export default async function (
  req: HttpRequest,
  res: HttpResponse,
  context: Context
) {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const {modelName, ...queryParameters} = req.params
    const Model = modelStore.get(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const {deleteCount} = await Model.delete({
      context,
      filter: new QueryFilter(queryParameters),
      user: context.get('base$user'),
    })

    if (deleteCount === 0) {
      throw new EntryNotFoundError()
    }

    const jsonApiRes = new JsonApiResponse({
      res,
      statusCode: 200,
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
