import {ModelNotFoundError} from '../../errors'
import Context from '../../context'
import HttpRequest from '../../http/request'
import HttpResponse from '../../http/response'
import JsonApiModel from '../../specs/jsonApi/model'
import JsonApiRequest from '../../specs/jsonApi/request'
import JsonApiResponse from '../../specs/jsonApi/response'

export default async function createModelAccessEntry(
  req: HttpRequest,
  res: HttpResponse,
  context: Context
) {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const Model = this.base$modelStore.get(req.params.modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: req.params.modelName})
    }

    const modelAccess = await this.create(
      {
        ...jsonApiReq.bodyFields,
        model: req.params.modelName,
      },
      {context, user: context.get('base$user')}
    )

    modelAccess.id = this.encodeModelAccessKey(modelAccess.get('user'))

    const jsonApiRes = new JsonApiResponse({
      entries: [<JsonApiModel>modelAccess],
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
