import type {Await} from '../../../utils/types'
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
    const fieldSet = jsonApiReq.fields[Model.base$handle]
    const searchText = jsonApiReq.url.getQueryParameter('search')
    const commonParameters = {
      context,
      fieldSet,
      filter: jsonApiReq.getQueryFilter(),
      pageNumber: jsonApiReq.pageNumber,
      pageSize: jsonApiReq.pageSize,
      user: context.get('base$user'),
    }
    const data = searchText
      ? await Model.search({...commonParameters, text: searchText})
      : await Model.find({
          ...commonParameters,
          sort: jsonApiReq.sort,
        })

    const {entries, pageSize, totalEntries, totalPages} = data
    const references = await jsonApiReq.resolveRelationships({
      entries,
      Model,
      user: context.get('base$user'),
    })
    const jsonApiRes = new JsonApiResponse({
      entries,
      fieldSet,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
      pageSize,
      res,
      searchScores: searchText
        ? (data as Await<ReturnType<typeof BaseModel['search']>>).scores
        : null,
      totalEntries,
      totalPages,
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
