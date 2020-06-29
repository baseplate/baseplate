import {ModelNotFoundError} from '../../../errors'
import Context from '../../../context'
import HttpRequest from '../../../http/request'
import HttpResponse from '../../../http/response'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'
import modelStore from '../../../modelStore/'
import QueryFilter from '../../../queryFilter'

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

    const query = QueryFilter.parse(jsonApiReq.filter, '$')
    const fieldSet = jsonApiReq.fields[Model.handle]
    const {entries, pageSize, totalEntries, totalPages} = await Model.find({
      context,
      fieldSet,
      filter: query,
      pageNumber: jsonApiReq.pageNumber,
      pageSize: jsonApiReq.pageSize,
      sort: jsonApiReq.sort,
      user: context.user,
    })
    const references = await jsonApiReq.resolveRelationships({
      entries,
      Model,
      user: context.user,
    })
    const jsonApiRes = new JsonApiResponse({
      entries,
      fieldSet,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
      pageSize,
      res,
      totalEntries,
      totalPages,
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
