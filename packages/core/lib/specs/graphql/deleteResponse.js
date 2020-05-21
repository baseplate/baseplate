const {GraphQLInt, GraphQLObjectType} = require('graphql')

module.exports = new GraphQLObjectType({
  fields: {
    deleteCount: {type: GraphQLInt}
  },
  name: 'DeleteResponse'
})
