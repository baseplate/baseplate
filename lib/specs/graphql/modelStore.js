const GraphQLSchema = require('./schema')
const ModelStore = require('../../modelStore/base')

class GraphQLSchemaStore extends ModelStore {
  constructor() {
    super(GraphQLSchema)
  }
}

module.exports = new GraphQLSchemaStore()
