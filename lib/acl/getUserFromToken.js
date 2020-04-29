const modelFactory = require('../modelFactory')
const schemaStore = require('../schemaStore')

module.exports = tokenData => {
  if (!tokenData) return

  const {id, level, model} = tokenData
  const userSchema = schemaStore.get(model)
  const User = modelFactory(userSchema)

  return new User({
    _id: id,
    accessLevel: level
  })
}
