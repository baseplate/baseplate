const {camelize} = require('inflected')
const {GraphQLList, GraphQLString, GraphQLUnionType} = require('graphql')
const GraphQLModel = require('../model')
const modelFactory = require('../../../modelFactory')
const TypeReference = require('../../../../packages/validator/fieldTypes/reference')

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
      this.schemas.length === 1
        ? this.schemas[0].graphQLType
        : new GraphQLUnionType({
            name: camelize(`${modelName}_${fieldName}_output`),
            types: this.schemas.map(schema => schema.graphQLType)
          })
    const resolve = async (root, args, context) => {
      const references = root[fieldName]

      if (!references) return null

      const referencesArray = Array.isArray(references)
        ? references
        : [references]
      const referenceModels = referencesArray.map(
        async ({_id: id, _type: type}) => {
          if (
            !id ||
            !type ||
            typeof id !== 'string' ||
            typeof type !== 'string'
          ) {
            return null
          }

          const referenceSchema = this.schemas.find(
            schema => schema.name === type
          )

          if (!referenceSchema) {
            return null
          }

          const ReferencedModel = modelFactory(
            referenceSchema.name,
            referenceSchema,
            {datastore: context.datastore, ParentClass: GraphQLModel}
          )
          const access = await ReferencedModel.getAccessForUser({
            accessType: 'read',
            user: context.user
          })

          return ReferencedModel.findOneById({
            fieldSet: access.fields,
            filter: access.filter,
            id
          })
        }
      )
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
