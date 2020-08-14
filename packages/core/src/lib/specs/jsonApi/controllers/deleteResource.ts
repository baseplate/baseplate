import type BaseModel from '../../../model/base'
import Context from '../../../context'
import {EntryNotFoundError} from '../../../errors'
import HttpRequest from '../../../http/request'
import HttpResponse from '../../../http/response'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'
import QueryFilter from '../../../queryFilter/'

export default async function (
  req: HttpRequest,
  res: HttpResponse,
  context: Context
) {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const Model = this as typeof BaseModel
    const {deleteCount} = await Model.delete({
      context,
      filter: new QueryFilter(req.params),
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
