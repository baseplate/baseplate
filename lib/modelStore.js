const fs = require('fs')
const path = require('path')

const {ModelConflictError} = require('./errors')
const modelFactory = require('./modelFactory')

const UserModel = require('./models/user')

const MODELS_PATH = path.join(process.cwd(), 'models')

class ModelStore {
  constructor({BaseClass, SchemaClass} = {}) {
    this.getModelByName = this.get.bind(this)
    this.BaseClass = BaseClass
    this.SchemaClass = SchemaClass

    const sourceFiles = this.loadSourceFilesFromDisk(MODELS_PATH)
    const models = sourceFiles.reduce((models, {name, source}) => {
      const normalizedName = name.toLowerCase()

      if (models[normalizedName]) {
        throw new ModelConflictError({name})
      }

      return {
        ...models,
        [normalizedName]: this.makeModel({
          BaseClass,
          name: normalizedName,
          source
        })
      }
    }, {})

    this.models = models

    Object.values(models).forEach(Model => {
      Model.schema.loadFieldHandlers()
    })
  }

  get(modelName) {
    if (modelName === '_user') {
      this.baseUserModel =
        this.baseUserModel ||
        modelFactory({
          BaseClass: UserModel,
          name: '_user',
          plural: '_users'
        })

      return this.baseUserModel
    }

    return this.models[modelName]
  }

  getAll({includeBaseUserModel} = {}) {
    return Object.values(this.models).concat(
      includeBaseUserModel ? this.get('_user') : []
    )
  }

  loadSourceFilesFromDisk(basePath) {
    const fileNames = fs.readdirSync(basePath)
    const sourceFiles = fileNames
      .map(fileName => {
        if (path.extname(fileName) !== '.js') {
          return null
        }

        const source = require(path.join(basePath, fileName))
        const name = source.name || path.basename(fileName, '.js')

        return {
          name,
          source
        }
      })
      .filter(Boolean)

    return sourceFiles
  }

  makeModel({name, source}) {
    return modelFactory({
      BaseClass: this.BaseClass,
      getModelByName: this.getModelByName,
      name,
      namePlural: source.plural,
      schema: source,
      SchemaClass: this.SchemaClass
    })
  }
}

module.exports = ModelStore
