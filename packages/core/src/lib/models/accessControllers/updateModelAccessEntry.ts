import {EntryNotFoundError, ModelNotFoundError} from '../../errors'
import Context from '../../context'
import HttpRequest from '../../http/request'
import HttpResponse from '../../http/response'
import JsonApiRequest from '../../specs/jsonApi/request'
import JsonApiResponse from '../../specs/jsonApi/response'
import User from '../user'

async function updateModelAccessEntry(
  req: HttpRequest,
  res: HttpResponse,
  context: Context
) {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const Model = this.store.get(req.params.modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: req.params.modelName})
    }

    const userData = this.decodeModelAccessKey(req.params.id)

    if (userData === undefined) {
      throw new EntryNotFoundError({id: req.params.id})
    }

    let user = null

    if (userData !== null) {
      const UserModel = this.store.get(userData.modelName)

      if (!UserModel) {
        throw new EntryNotFoundError({id: req.params.id})
      }

      user = <User>new UserModel({_id: userData.id})
    }

    const [modelAccess] = await this.updateAccessEntry({
      context,
      modelName: req.params.modelName,
      update: jsonApiReq.bodyFields,
      user,
    })

    modelAccess.id = this.encodeModelAccessKey(modelAccess.get('user'))

    const references = await jsonApiReq.resolveRelationships({
      entries: [modelAccess],
      Model,
    })
    const jsonApiRes = new JsonApiResponse({
      entries: modelAccess,
      includedReferences: Object.values(references),
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

export default updateModelAccessEntry
