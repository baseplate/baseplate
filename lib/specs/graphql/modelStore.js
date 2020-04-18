const GraphQLModel = require('./model')
const GraphQLSchema = require('./schema')
const ModelStore = require('../../modelStore')

class GraphQLModelStore extends ModelStore {
  constructor() {
    super({BaseClass: GraphQLModel, SchemaClass: GraphQLSchema})
  }
}

module.exports = GraphQLModelStore
