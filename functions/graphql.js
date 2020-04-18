const {graphql, GraphQLObjectType, GraphQLSchema} = require('graphql')

const GraphQLModelStore = require('../lib/specs/graphql/modelStore')

const modelStore = new GraphQLModelStore()
const models = modelStore.getAll()

const queries = models.reduce(
  (result, Model) => ({
    ...result,
    ...Model.getGraphQLQueries()
  }),
  {}
)
const mutations = models.reduce(
  (result, Model) => ({
    ...result,
    ...Model.getGraphQLMutations()
  }),
  {}
)
const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: queries
  }),
  mutation: new GraphQLObjectType({
    name: 'Mutation',
    fields: mutations
  })
})

module.exports.post = async event => {
  const body = JSON.parse(event.body)
  const result = await graphql({
    schema,
    source: body.query,
    variableValues: body.variables
  })

  return {
    body: JSON.stringify(result),
    statusCode: 200
  }
}
