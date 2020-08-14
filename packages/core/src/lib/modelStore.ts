import {camelize, classify, pluralize, titleize} from 'inflected'
import {Schema} from '@baseplate/validator'

import AccessModel from './internalModels/access'
import BaseModel from './model/base'
import {DataConnector} from './dataConnector/interface'
import {
  Interfaces,
  InterfacesBlock,
  isClass as isModelClass,
  ModelDefinition,
} from './model/definition'
import logger from './logger'
import ModelsModel from './internalModels/model'
import RefreshTokenModel from './internalModels/refreshToken'
import UserModel from './internalModels/user'
import * as types from './types'

const internalModels = [AccessModel, ModelsModel, RefreshTokenModel, UserModel]

export class ModelStore {
  dataConnector: DataConnector
  models: Map<string, typeof BaseModel>

  constructor() {
    this.models = new Map()
  }

  buildInterfacesBlock(Model: typeof BaseModel, source: ModelDefinition) {
    const sourceInterfaces: InterfacesBlock =
      (isModelClass(source) ? source.base$interfaces : source.interfaces) || {}
    const interfaces: InterfacesBlock = {}

    for (const name of Object.keys(Interfaces) as Interfaces[]) {
      if (typeof sourceInterfaces[name] === 'string') {
        interfaces[name] = sourceInterfaces[name]
      } else if (sourceInterfaces[name] === false) {
        interfaces[name] = null
      } else {
        if (sourceInterfaces[name] === undefined && Model.base$isInternal()) {
          interfaces[name] = null
        }

        switch (name) {
          case Interfaces.graphQLCreateResource:
            interfaces[name] = camelize(`create_${Model.base$handle}`, false)

            break

          case Interfaces.graphQLDeleteResource:
            interfaces[name] = camelize(`delete_${Model.base$handle}`, false)

            break

          case Interfaces.graphQLFindResource:
            interfaces[name] = camelize(Model.base$handle)

            break

          case Interfaces.graphQLFindResources:
            interfaces[name] = camelize(Model.base$handlePlural)

            break

          case Interfaces.graphQLUpdateResource:
            interfaces[name] = camelize(`update_${Model.base$handle}`, false)

            break

          case Interfaces.graphQLUpdateResources:
            interfaces[name] = camelize(
              `update_${Model.base$handlePlural}`,
              false
            )

            break

          case Interfaces.restDeleteResource:
          case Interfaces.restFindResource:
          case Interfaces.restUpdateResource:
            interfaces[name] = `/${Model.base$handlePlural}/:_id`

            break

          case Interfaces.restCreateResource:
          case Interfaces.restFindResources:
            interfaces[name] = `/${Model.base$handlePlural}`

            break

          case Interfaces.restFindResourceField:
            interfaces[name] = `/${Model.base$handlePlural}/:_id/:fieldName`

            break

          case Interfaces.restFindResourceFieldRelationship:
            interfaces[
              name
            ] = `/${Model.base$handlePlural}/:_id/relationships/:fieldName`
        }
      }
    }

    return interfaces
  }

  private buildModel(
    name: string,
    source: ModelDefinition,
    database: DataConnector
  ): typeof BaseModel {
    const handle = this.normalizeHandle(name)
    const schema = new Schema({
      fields: isModelClass(source) ? source.base$fields : source.fields,
      handlers: types,
    })
    const modelProperties = {
      base$db: {
        value: database,
      },
      base$handle: {
        value: handle,
      },
      base$handlePlural: {
        value:
          (isModelClass(source) ? source.base$handlePlural : source.plural) ||
          pluralize(handle),
      },
      base$graphQL: {
        value: {},
      },
      base$label: {
        value:
          (isModelClass(source) ? source.base$label : source.label) ||
          pluralize(titleize(name)),
      },
      base$modelStore: {
        value: this,
      },
      base$routes: {
        value:
          (isModelClass(source) ? source.base$routes : source.routes) || {},
      },
      base$schema: {
        value: schema,
      },
      name: {
        value: (isModelClass(source) && source.name) || classify(name),
      },
    }
    const NewModel = isModelClass(source)
      ? class extends source {}
      : class extends BaseModel {}

    logger.debug('Loading model: %s', handle)

    Object.defineProperties(NewModel, modelProperties)
    Object.defineProperties(NewModel, {
      base$interfacePaths: {
        value: this.buildInterfacesBlock(NewModel, source),
      },
    })

    return NewModel
  }

  private normalizeHandle(handle: string) {
    return handle.toString().toLowerCase()
  }

  get(handle: string) {
    return this.models.get(this.normalizeHandle(handle))
  }

  getAll() {
    return Array.from(this.models.values())
  }

  getByPluralForm(handlePlural: string) {
    const normalizedHandle = this.normalizeHandle(handlePlural)

    return Array.from(this.models.values()).find((Model) => {
      return Model.base$handlePlural === normalizedHandle
    })
  }

  has(handle: string) {
    return this.models.has(this.normalizeHandle(handle))
  }

  hasPluralForm(handlePlural: string) {
    const normalizedHandle = this.normalizeHandle(handlePlural)

    return Array.from(this.models.values()).some((source) => {
      return source.base$handlePlural === normalizedHandle
    })
  }

  load(input: any) {
    const sources = (Array.isArray(input) ? input : [input]).map((source) =>
      this.resolveSourceModule(source)
    )
    const loadedModels: typeof BaseModel[] = []

    sources.forEach((source) => {
      if (!source.name) {
        logger.error(
          'Model using the object syntax is missing a `name` property: %o',
          source
        )

        return
      }

      const Model = this.buildModel(source.name, source, this.dataConnector)

      loadedModels.push(Model)

      this.models.set(this.normalizeHandle(Model.base$handle), Model)
    })

    loadedModels.forEach((Model) => {
      Model.base$schema.loadFieldHandlers()

      // (!) TO DO: Handle model validation.
      // const errors = Model.base$schema.validateOptions()
    })

    return loadedModels
  }

  reset() {
    this.models = new Map()
    this.load(internalModels)
  }

  resolveSourceModule(input: any): ModelDefinition {
    return input.__esModule ? input.default : input
  }

  setDataConnector(dataConnector: DataConnector) {
    logger.debug(
      'Setting main data connector: %s',
      dataConnector.constructor.name
    )

    this.dataConnector = dataConnector

    this.load(internalModels)
  }
}

export default new ModelStore()
