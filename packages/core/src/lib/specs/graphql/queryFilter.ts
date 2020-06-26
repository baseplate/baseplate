import {GraphQLScalarType} from 'graphql'

const queryFilterType = new GraphQLScalarType({
  name: 'GraphQLQueryFilterType',
  serialize: null,
})

export default queryFilterType
