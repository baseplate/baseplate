const {camelize} = require('inflected')
const {GraphQLList, GraphQLString, GraphQLUnionType} = require('graphql')
const getGraphQLModel = require('../getGraphQLModel')
const TypeReference = require('../../../../../../packages/validator/fieldTypes/reference')

class GraphQLTypeReference extends TypeReference {
  // (!) TO DO
  getGraphQLInputType() {
    return {
      type: GraphQLString
    }
  }

  getGraphQLOutputType({fieldName, modelName}) {
    const isMultiple =
      Array.isArray(this.options) || Array.isArray(this.options.type)
    const type =
      this.models.length === 1
        ? this.models[0].schema.graphQLType
        : new GraphQLUnionType({
            name: camelize(`${modelName}_${fieldName}_output`),
            types: this.models.map(({schema}) => schema.graphQLType)
          })
    const resolve = async (root, args, context) => {
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

        const ReferencedModel = this.models.find(Model => Model.handle === type)

        if (!ReferencedModel) {
          return null
        }

        const Access = this.modelStore.get('base_access')
        const access = await Access.getAccess({
          accessType: 'create',
          context,
          modelName: ReferencedModel.handle,
          user: context.user
        })

        if (access.toObject() === false) {
          return null
        }

        const ReferencedGraphQLModel = getGraphQLModel({
          Access,
          Model: ReferencedModel
        })

        return ReferencedGraphQLModel.findOneById({
          context,
          fieldSet: access.fields,
          filter: access.filter,
          id
        })
      })
      const entries = await Promise.all(referenceModels)
      const objects = entries
        .filter(Boolean)
        .map(entry => entry.toObject({includeModelInstance: true}))

      return isMultiple ? objects : objects[0]
    }

    return {
      type: isMultiple ? new GraphQLList(type) : type,
      resolve
    }
  }
}

module.exports = GraphQLTypeReference
