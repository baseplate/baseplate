const BaseModel = require('./model')
const createDatastore = require('./datastore/factory')

module.exports = function modelFactory(
  rawName,
  schema,
  {datastore, ParentClass = BaseModel} = {}
) {
  const name = rawName.toLowerCase()

  if (typeof schema === 'function' && typeof schema.getSchema === 'function') {
    ParentClass = schema
    schema = schema.getSchema()
  }

  const Model = class extends ParentClass {}
  const modelProperties = {
    datastore: {
      value: datastore || createDatastore()
    },
    name: {
      enumerable: true,
      value: name
    },
    plural: {
      value: schema.plural
    },
    schema: {
      value: schema
    }
  }

  Object.defineProperties(Model, modelProperties)

  return Model
}
