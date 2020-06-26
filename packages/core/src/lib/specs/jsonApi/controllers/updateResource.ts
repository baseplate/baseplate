import {
  ForbiddenError,
  ModelNotFoundError,
  UnauthorizedError,
} from '../../../errors'
import AccessModel from '../../../models/access'
import Context from '../../../context'
import HttpRequest from '../../../http/request'
import HttpResponse from '../../../http/response'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'
import JsonApiModel from '../model'
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
      accessType: 'update',
      context,
      modelName: Model.handle,
      user: context.user,
    })

    if (access.toObject() === false) {
      throw context.user ? new ForbiddenError() : new UnauthorizedError()
    }

    const {id} = jsonApiReq.params
    const entry = <JsonApiModel>await Model.updateOneById({
      id,
      update: jsonApiReq.bodyFields,
    })
    const references = await jsonApiReq.resolveRelationships({
      entries: [entry],
      Model,
    })
    const jsonApiRes = new JsonApiResponse({
      entries: entry,
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
