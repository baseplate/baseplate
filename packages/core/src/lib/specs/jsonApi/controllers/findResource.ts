import {EntryNotFoundError, ModelNotFoundError} from '../../../errors'
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

    const fieldSet = jsonApiReq.fields[Model.base$handle]
    const {id} = jsonApiReq.params
    const entry = <JsonApiModel>await Model.findOneById({
      context,
      fieldSet,
      id,
      user: context.get('base$user'),
    })

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const references = await jsonApiReq.resolveRelationships({
      entries: [entry],
      Model,
      user: context.get('base$user'),
    })
    const jsonApiRes = new JsonApiResponse({
      entries: entry,
      fieldSet,
      includedReferences: Object.values(references),
      includeTopLevelLinks: true,
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
