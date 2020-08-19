import {camelize} from 'inflected'
import {
  FieldCastQueryParameters,
  FieldConstructorParameters,
  FieldValidationError,
  types,
} from '@baseplate/validator'
import type GraphQL from 'graphql'

import AccessModel from '../internalModels/access'
import BaseModel from '../model/base'
import Context from '../context'
import modelStore from '../modelStore'
import QueryFilter from '../queryFilter/'

export default class CoreFieldReference extends types.FieldReference {
  models: Array<typeof BaseModel>

  constructor(props: FieldConstructorParameters) {
    super(props)

    this.models = props.children.map(({type}: {type: string}) =>
      modelStore.get(type)
    )
  }

  cast({path, value}: {path: string[]; value: any}) {
    if (!(value instanceof BaseModel)) {
      return super.cast({path, value})
    }

    const isValid = this.models.some((Model) => value instanceof Model)

    if (!isValid) {
      throw new FieldValidationError({path, type: this.modelNames.join(', ')})
    }

    // (!) TO DO: Cast to instance of BaseModel instead.
    return {
      type: (<typeof BaseModel>value.constructor).base$handle,
      id: value.id,
    }
  }

  castQuery({value}: FieldCastQueryParameters) {
    if (value instanceof BaseModel) {
      return {
        id: value.id,
        type: (<typeof BaseModel>value.constructor).base$handle,
      }
    }

    return value
  }

  // (!) TO DO
  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: graphql.GraphQLString,
    }
  }

  getGraphQLOutputType(
    graphql: typeof GraphQL,
    fieldName: string,
    Model: typeof BaseModel
  ) {
    const isMultiple =
      Array.isArray(this.options) || Array.isArray(this.options.type)
    const type =
      this.models.length === 1
        ? this.models[0].base$graphQL.objectType
        : new graphql.GraphQLUnionType({
            name: camelize(`${Model.base$handle}_${fieldName}_output`),
            types: this.models.map((Model) => Model.base$graphQL.objectType),
          })
    const resolve = async (root: any, args: object, context: Context) => {
      const references = root[fieldName]

      if (!references) return null

      const referencesArray = Array.isArray(references)
        ? references
        : [references]
      const referenceModels = referencesArray.map(async ({id, type}) => {
        if (
          !id ||
          !type ||
          typeof id !== 'string' ||
          typeof type !== 'string'
        ) {
          return null
        }

        const ReferencedModel = this.models.find(
          (Model) => Model.base$handle === type
        )

        if (!ReferencedModel) {
          return null
        }

        const Access = <typeof AccessModel>modelStore.get('base$access')
        const access = await Access.getAccess({
          accessType: 'read',
          context,
          modelName: ReferencedModel.base$handle,
          user: context.get('base$user'),
        })

        if (access.toObject() === false) {
          return null
        }

        const filter = new QueryFilter({_id: id}).intersectWith(access.filter)

        return ReferencedModel.findOne({
          context,
          fieldSet: access.fields,
          filter,
          user: context.get('base$user'),
        })
      })
      const entries = await Promise.all(referenceModels)
      const objects = entries
        .filter(Boolean)
        .map((entry) => entry.toObject({includeModelInstance: true}))

      return isMultiple ? objects : objects[0]
    }

    return {
      type: isMultiple ? new graphql.GraphQLList(type) : type,
      resolve,
    }
  }
}
