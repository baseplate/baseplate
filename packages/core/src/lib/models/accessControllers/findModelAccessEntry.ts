import {EntryNotFoundError, ModelNotFoundError} from '../../errors'
import Context from '../../context'
import HttpRequest from '../../http/request'
import HttpResponse from '../../http/response'
import JsonApiRequest from '../../specs/jsonApi/request'
import JsonApiResponse from '../../specs/jsonApi/response'
import User from '../user'

async function findModelAccessEntry(
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
      throw new EntryNotFoundError({id: req.params.id})
    }

    let user = null

    if (userData !== null) {
      const UserModel = this.base$modelStore.get(userData.modelName)

      if (!UserModel) {
        throw new EntryNotFoundError({id: req.params.id})
      }

      user = <User>new UserModel({_id: userData.id})
    }

    const entries = await this.getAccessEntries({
      modelName: req.params.modelName,
      user,
    })

    if (entries.length === 0) {
      throw new EntryNotFoundError({id: req.params.id})
    }

    const references = await jsonApiReq.resolveRelationships({
      entries,
      Model,
      user: context.get('base$user'),
    })
    const jsonApiRes = new JsonApiResponse({
      entries: entries[0],
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

export default findModelAccessEntry
