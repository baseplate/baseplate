import type BaseModel from '../../../model/base'
import {
  EntryFieldNotFoundError,
  EntryNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from '../../../errors'
import Context from '../../../context'
import HttpRequest from '../../../http/request'
import HttpResponse from '../../../http/response'
import JsonApiRequest from '../request'
import JsonApiResponse from '../response'
import QueryFilter from '../../../queryFilter/'
import {RelationshipData} from '../relationship'

export default async function (
  req: HttpRequest,
  res: HttpResponse,
  context: Context
) {
  const jsonApiReq = new JsonApiRequest(req, context)

  try {
    const {fieldName, ...queryParameters} = req.params
    const Model = this as typeof BaseModel
    const access = await Model.base$getAccess({
      accessType: 'read',
      context,
      user: context.get('base$user'),
    })

    if (access.toObject() === false) {
      throw context.get('base$user')
        ? new ForbiddenError()
        : new UnauthorizedError()
    }

    if (
      !Model.base$schema.handlers[fieldName] ||
      (access.fields && !access.fields.has(fieldName))
    ) {
      throw new EntryFieldNotFoundError({
        fieldName,
        modelName: Model.base$handle,
      })
    }

    const entry = await Model.findOne({
      context,
      filter: new QueryFilter(queryParameters),
      user: context.get('base$user'),
    })

    if (!entry) {
      throw new EntryNotFoundError()
    }

    const jsonApiRes = new JsonApiResponse({
      includeTopLevelLinks: true,
      relationships: entry.get(fieldName),
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
