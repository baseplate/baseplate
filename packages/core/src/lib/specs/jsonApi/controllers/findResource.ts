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
    const fieldSet = jsonApiReq.fields[Model.base$handle]
    const {entries} = await Model.find({
      context,
      fieldSet,
      filter: new QueryFilter(req.params),
      user: context.get('base$user'),
    })

    if (entries.length === 0) {
      throw new EntryNotFoundError()
    }

    const references = await jsonApiReq.resolveRelationships({
      entries,
      Model,
      user: context.get('base$user'),
    })
    const jsonApiRes = new JsonApiResponse({
      entries: entries[0],
      fieldSet,
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
