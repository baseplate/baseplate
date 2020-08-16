import type BaseModel from '../../../model/base'
import Context from '../../../context'
import HttpRequest from '../../../http/request'
import HttpResponse from '../../../http/response'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'

export default async function (
  req: HttpRequest,
  res: HttpResponse,
  context: Context
) {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const Model = this as typeof BaseModel
    const entry = await Model.create(jsonApiReq.bodyFields, {
      context,
      user: context.get('base$user'),
    })
    const jsonApiRes = new JsonApiResponse({
      entries: [entry],
      res,
      statusCode: 201,
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
