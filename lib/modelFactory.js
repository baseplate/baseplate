const BaseModel = require('./model')
const createDatastore = require('./datastore/factory')

module.exports = function modelFactory(source, {context = {}} = {}) {
  let Model
  let schema

  if (typeof source === 'function') {
    Model = class extends source {}
    schema = source.schema
  } else {
    Model = class extends BaseModel {}
    schema = source
  }

  const modelProperties = {
    context: {
      value: context
    },
    datastore: {
      value: context.datastore || createDatastore()
    },
    name: {
      enumerable: true,
      value: schema.name
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
