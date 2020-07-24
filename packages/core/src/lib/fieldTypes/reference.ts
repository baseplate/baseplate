import {camelize} from 'inflected'
import {FieldReference} from '@baseplate/validator'
import type GraphQL from 'graphql'

import AccessModel from '../internalModels/access'
import type BaseModel from '../model/base'
import Context from '../context'
import modelStore from '../modelStore'

export default class CoreFieldReference extends FieldReference.FieldHandler {
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
          accessType: 'create',
          context,
          modelName: ReferencedModel.base$handle,
          user: context.get('base$user'),
        })

        if (access.toObject() === false) {
          return null
        }

        return ReferencedModel.findOneById({
          context,
          fieldSet: access.fields,
          filter: access.filter,
          id,
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
