const modelFactory = require('../modelFactory')
const schemaStore = require('../schemaStore')
const UserSchema = require('../internalSchemas/user')

module.exports = tokenData => {
  if (!tokenData) return

  const {id, level, model} = tokenData
  const userSchema = model === '_user' ? UserSchema : schemaStore.get(model)
  const User = modelFactory(model, userSchema)

  return new User({
    _id: id,
    accessLevel: level
  })
}
