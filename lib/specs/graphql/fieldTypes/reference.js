const {GraphQLList, GraphQLString, GraphQLUnionType} = require('graphql')
const capitalizeString = require('../../../utils/capitalizeString')
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
      this.models.length === 1
        ? this.models[0].getGraphQLType()
        : new GraphQLUnionType({
            name: modelName + capitalizeString(fieldName) + 'Output',
            types: this.models.map(Model => Model.getGraphQLType())
          })
    const resolve = async root => {
      const references = root[fieldName]

      if (!references) return null

      const referencesArray = Array.isArray(references)
        ? references
        : [references]
      const referenceModels = referencesArray.map(({_id: id, _type: type}) => {
        if (
          !id ||
          !type ||
          typeof id !== 'string' ||
          typeof type !== 'string'
        ) {
          return null
        }

        const ReferencedModel = this.models.find(Model => Model.name === type)

        if (!ReferencedModel) {
          return null
        }

        return ReferencedModel.findOneById({id})
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
