module.exports = (tokenData, modelStore) => {
  if (!tokenData) return

  const {id, level, model} = tokenData
  const User = modelStore.get(model)

  return new User({
    _id: id,
    accessLevel: level,
  })
}
