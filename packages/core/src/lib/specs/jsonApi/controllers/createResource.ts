import {ModelNotFoundError} from '../../../errors'
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

    const model = await Model.create(jsonApiReq.bodyFields, {
      context,
      user: context.get('base$user'),
    })
    const jsonApiRes = new JsonApiResponse({
      entries: [<JsonApiModel>model],
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
