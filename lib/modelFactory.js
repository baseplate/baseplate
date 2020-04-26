const BaseModel = require('./model')
const QueryBatcher = require('./queryBatcher')

const modelCache = new Map()

module.exports = function modelFactory(
  rawName,
  schema,
  {ParentClass = BaseModel} = {}
) {
  const name = rawName.toLowerCase()

  if (modelCache.has(name)) {
    return modelCache.get(name)
  }

  if (typeof schema === 'function' && typeof schema.getSchema === 'function') {
    ParentClass = schema
    schema = schema.getSchema()
  }

  const Model = class extends ParentClass {}
  const queryBatcher = new QueryBatcher(Model)
  const modelProperties = {
    name: {
      enumerable: true,
      value: name
    },
    plural: {
      value: schema.plural
    },
    queryBatcher: {
      value: queryBatcher
    },
    schema: {
      value: schema
    }
  }

  Object.defineProperties(Model, modelProperties)

  modelCache.set(name, Model)

  return Model
}
