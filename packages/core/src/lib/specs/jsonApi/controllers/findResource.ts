import {
  EntryNotFoundError,
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError,
} from '../../../errors'
import AccessModel from '../../../models/access'
import Context from '../../../context'
import FieldSet from '../../../fieldSet'
import HttpRequest from '../../../http/request'
import HttpResponse from '../../../http/response'
import JsonApiModel from '../model'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'
import modelStore from '../../../modelStore/'

module.exports = async (
  req: HttpRequest,
  res: HttpResponse,
  context: Context
) => {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const modelName = req.params.modelName
    const Model = modelStore.getByPluralForm(modelName)

    if (!Model) {
      throw new ModelNotFoundError({name: modelName})
    }

    const Access = <typeof AccessModel>modelStore.get('base_access')
    const access = await Access.getAccess({
      accessType: 'read',
      context,
      modelName: Model.handle,
      user: context.user,
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const fieldSet = FieldSet.intersect(
      access.fields,
      jsonApiReq.fields[Model.handle]
    )
    const {id} = jsonApiReq.params
    const entry = <JsonApiModel>await Model.findOneById({
      context,
      fieldSet,
      filter: access.filter,
      id,
    })

    if (!entry) {
      throw new EntryNotFoundError({id})
    }

    const references = await jsonApiReq.resolveRelationships({
      entries: [entry],
      Model,
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
