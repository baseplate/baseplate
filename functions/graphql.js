const graphql = require('graphql')

const GraphQLModel = require('../lib/specs/graphql/model')
const graphQLSchemaStore = require('../lib/specs/graphql/schemaStore')
const modelFactory = require('../lib/modelFactory')

const schemas = graphQLSchemaStore.getAll()
const models = Object.entries(schemas).map(([name, schema]) => {
  return modelFactory(name, schema, {ParentClass: GraphQLModel})
})
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
const schema = new graphql.GraphQLSchema({
  query: new graphql.GraphQLObjectType({
    name: 'Query',
    fields: queries
  }),
  mutation: new graphql.GraphQLObjectType({
    name: 'Mutation',
    fields: mutations
  })
})

module.exports.post = async event => {
  const body = JSON.parse(event.body)
  const result = await graphql.graphql({
    schema,
    source: body.query,
    variableValues: body.variables
  })

  return {
    body: JSON.stringify(result),
    statusCode: 200
  }
}
