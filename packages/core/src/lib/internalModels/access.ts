import {AccessValue} from '../accessValue'
import BaseModel, {AfterAuthenticateParameters} from '../model/base'
import Context from '../context'
import createModelAccessEntry from './accessControllers/createModelAccessEntry'
import findModelAccessEntries from './accessControllers/findModelAccessEntries'
import findModelAccessEntry from './accessControllers/findModelAccessEntry'
import JsonApiEntry from '../specs/jsonApi/entry'
import QueryFilter from '../queryFilter'
import updateModelAccessEntry from './accessControllers/updateModelAccessEntry'
import User from './user'

export type AccessType = 'delete' | 'create' | 'read' | 'update'

export interface DatabaseAccess {
  model: string
  user: {
    id: string
    type: string
  }
}

const accessValueProps = {
  type: 'Mixed',
  default: false,
  get: (value: any) => {
    return new AccessValue(value, '_').toObject('$')
  },
  set: (value: any) => {
    return new AccessValue(value, '$').toObject('_')
  },
}

export default class Base$Access extends BaseModel {
  static base$fields = {
    user: {
      type: 'base$user',
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    create: accessValueProps,
    read: accessValueProps,
    update: accessValueProps,
    delete: accessValueProps,
  }

  static base$routes = {
    '/base$models/:modelName/access': {
      get: findModelAccessEntries,
      post: createModelAccessEntry,
    },
    '/base$models/:modelName/access/:id': {
      get: findModelAccessEntry,
      patch: updateModelAccessEntry,
    },
  }

  static decodeModelAccessKey(key: string) {
    if (key === 'public') {
      return null
    }

    const separatorIndex = key.lastIndexOf('_')

    if (separatorIndex > -1) {
      return {
        id: key.slice(separatorIndex + 1),
        modelName: key.slice(0, separatorIndex),
      }
    }
  }

  static encodeModelAccessKey(user: Record<string, any>) {
    if (!user) {
      return 'public'
    }

    return `${user.type}_${user.id}`
  }

  public static async getAccess({
    accessType,
    context,
    includePublicUser = true,
    modelName,
    user,
  }: {
    accessType: AccessType
    context?: Context
    includePublicUser?: boolean
    modelName: string
    user: User
  }) {
    if (user && user.isAdmin()) {
      return new AccessValue(true)
    }

    const entries = await this.getAccessEntries({
      context,
      includePublicUser,
      modelName,
      user,
    })

    if (entries.length === 0) {
      return new AccessValue(false)
    }

    const value = entries.reduce((value: AccessValue, entry: Base$Access) => {
      const valueForType = new AccessValue(entry.get(accessType))

      return AccessValue.unite(value, valueForType)
    }, new AccessValue(false))

    return value
  }

  static async getAccessEntries({
    context,
    includePublicUser,
    modelName,
    user,
  }: {
    context?: Context
    includePublicUser?: boolean
    modelName: string
    user?: User
  }) {
    let filter

    if (user) {
      const userFilter = QueryFilter.parse({
        'user.id': user.id,
        'user.type': (<typeof User>user.constructor).base$handle,
      })

      filter = userFilter
    }

    if (includePublicUser) {
      const publicUserFilter = QueryFilter.parse({user: null})

      filter = filter ? filter.uniteWith(publicUserFilter) : publicUserFilter
    }

    const {results} = await this.base$db.find(
      {
        filter,
      },
      this,
      context
    )
    const entries = results
      .filter((result: DatabaseAccess) => result.model === modelName)
      .map((result: DatabaseAccess) => {
        const id = this.encodeModelAccessKey(result.user)

        return new this({...result, _id: id})
      })

    return entries
  }

  static async updateAccessEntry({
    context,
    modelName,
    update,
    user,
  }: {
    context: Context
    modelName: string
    update: object
    user: User
  }) {
    const filter = QueryFilter.parse({model: modelName})

    if (user) {
      const userQuery = {
        'user.id': user.id,
        'user.type': (<typeof User>user.constructor).base$handle,
      }

      filter.intersectWith(QueryFilter.parse(userQuery))
    } else {
      const publicUserQuery = QueryFilter.parse({user: null})

      filter.intersectWith(publicUserQuery)
    }

    const results = await this.update({
      context,
      filter,
      update,
      user: context.get('base$user'),
    })

    return results.map((result: DatabaseAccess) => {
      const id = this.encodeModelAccessKey(result.user)

      return new this({...result, _id: id})
    })
  }

  base$jsonApiPostFormat(
    formattedEntry: JsonApiEntry,
    originalEntry: BaseModel
  ) {
    formattedEntry.attributes.model = undefined
    formattedEntry.relationships.user.links = undefined

    return formattedEntry
  }
}
