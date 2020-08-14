import {EntryNotFoundError, ModelNotFoundError} from '../../errors'
import Context from '../../context'
import HttpRequest from '../../http/request'
import HttpResponse from '../../http/response'
import JsonApiRequest from '../../specs/jsonApi/request'
import JsonApiResponse from '../../specs/jsonApi/response'
import User from '../user'

export default async function updateModelAccessEntry(
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

    const userData = this.decodeModelAccessKey(req.params.id)

    if (userData === undefined) {
      throw new EntryNotFoundError()
    }

    let user = null

    if (userData !== null) {
      const UserModel = this.base$modelStore.get(userData.modelName)

      if (!UserModel) {
        throw new EntryNotFoundError()
      }

      user = <User>new UserModel({_id: userData.id})
    }

    const [modelAccess] = await this.updateAccessEntry({
      context,
      modelName: req.params.modelName,
      update: jsonApiReq.bodyFields,
      user,
    })

    if (!modelAccess) {
      throw new EntryNotFoundError()
    }

    modelAccess.id = this.encodeModelAccessKey(modelAccess.get('user'))

    const references = await jsonApiReq.resolveRelationships({
      entries: [modelAccess],
      Model,
      user: context.get('base$user'),
    })
    const jsonApiRes = new JsonApiResponse({
      entries: modelAccess,
      includedReferences: Object.values(references),
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
