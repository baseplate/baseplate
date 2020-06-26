import {GraphQLInt, GraphQLObjectType} from 'graphql'

const deleteResponseType = new GraphQLObjectType({
  fields: {
    deleteCount: {type: GraphQLInt},
  },
  name: 'DeleteResponse',
})

export default deleteResponseType
