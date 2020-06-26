import {camelize} from 'inflected'
import {FieldReference} from '@baseplate/validator'
import {GraphQLList, GraphQLString, GraphQLUnionType} from 'graphql'

import {GraphQLModelStore} from '../modelStore'
import AccessModel from '../../../models/access'
import Context from '../../../context'
import getGraphQLModel from '../getGraphQLModel'

export default class GraphQLFieldReference extends FieldReference.FieldHandler {
  modelStore: GraphQLModelStore

  constructor({modelStore, ...props}: FieldReference.ConstructorParameters) {
    super(props)

    this.modelStore = modelStore
  }

  // (!) TO DO
  getGraphQLInputType() {
    return {
      type: GraphQLString,
    }
  }

  getGraphQLOutputType({
    fieldName,
    modelName,
  }: {
    fieldName: string
    modelName: string
  }) {
    const isMultiple =
      Array.isArray(this.options) || Array.isArray(this.options.type)
    const type =
      this.models.length === 1
        ? this.models[0].schema.graphQLType
        : new GraphQLUnionType({
            name: camelize(`${modelName}_${fieldName}_output`),
            types: this.models.map(({schema}) => schema.graphQLType),
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
          (Model) => Model.handle === type
        )

        if (!ReferencedModel) {
          return null
        }

        const Access = <typeof AccessModel>this.modelStore.get('base_access')
        const access = await Access.getAccess({
          accessType: 'create',
          context,
          modelName: ReferencedModel.handle,
          user: context.user,
        })

        if (access.toObject() === false) {
          return null
        }

        const ReferencedGraphQLModel = getGraphQLModel(ReferencedModel, Access)

        return ReferencedGraphQLModel.findOneById({
          context,
          fieldSet: access.fields,
          filter: access.filter,
          id,
        })
      })
      const entries = await Promise.all(referenceModels)
      const objects = entries
        .filter(Boolean)
        .map((entry) => entry.toObject({includeModelInstance: true}))

      return isMultiple ? objects : objects[0]
    }

    return {
      type: isMultiple ? new GraphQLList(type) : type,
      resolve,
    }
  }
}
