const DataLoader = require('dataloader')
const pluralize = require('pluralize')

const BaseModel = require('./model')

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

  const Model = class extends ParentClass {}
  const modelProperties = {
    _findById: {
      value: new DataLoader(ParentClass.batchFindById.bind(Model))
    },
    name: {
      enumerable: true,
      value: name
    },
    plural: {
      value: schema.plural || pluralize(name)
    },
    schema: {
      value: schema
    }
  }

  Object.defineProperties(Model, modelProperties)

  modelCache.set(name, Model)

  return Model
}
