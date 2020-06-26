import {ModelNotFoundError} from '../../errors'
import Context from '../../context'
import HttpRequest from '../../http/request'
import HttpResponse from '../../http/response'
import JsonApiModel from '../../specs/jsonApi/model'
import JsonApiRequest from '../../specs/jsonApi/request'
import JsonApiResponse from '../../specs/jsonApi/response'

async function findModelAccessEntries(
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

    const entries = await this.getAccessEntries({
      modelName: req.params.modelName,
    })
    const references = await jsonApiReq.resolveRelationships({
      entries: <JsonApiModel[]>entries,
      Model,
    })
    const jsonApiRes = new JsonApiResponse({
      entries: <JsonApiModel[]>entries,
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

export default findModelAccessEntries
