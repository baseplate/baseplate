const DataLoader = require('dataloader')
const pluralize = require('pluralize')

const Model = require('./model')
const Schema = require('./schema')

module.exports = function modelFactory({
  BaseClass = Model,
  getModelByName,
  name,
  plural,
  schema: schemaSource,
  SchemaClass = Schema
}) {
  const Model = class extends BaseClass {}

  plural = plural || pluralize(name)

  const modelProperties = {
    _findById: {
      value: new DataLoader(BaseClass._batchFindById.bind(Model))
    },
    name: {
      enumerable: true,
      value: name
    },
    plural: {
      enumerable: true,
      value: plural
    }
  }

  if (schemaSource) {
    const schema = new SchemaClass({
      fields: {
        ...schemaSource.fields,
        _createdAt: Number,
        _updatedAt: Number
      },
      getModelByName,
      name,
      virtuals: schemaSource.virtuals
    })

    modelProperties.schema = {
      enumerable: false,
      value: schema
    }
  } else if (typeof Model.getSchema === 'function') {
    const schema = new SchemaClass({
      ...Model.getSchema(),
      getModelByName
    })

    modelProperties.schema = {
      enumerable: false,
      value: schema
    }
  }

  Object.defineProperties(Model, modelProperties)

  return Model
}
