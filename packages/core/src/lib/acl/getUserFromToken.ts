import ModelStore from '../modelStore/base'
import TokenData from './tokenData'

const getUserFromToken = (tokenData: TokenData, modelStore: ModelStore) => {
  if (!tokenData) return

  const {id, level, model} = tokenData
  const User = modelStore.get(model)

  return new User({
    _id: id,
    accessLevel: level,
  })
}

export default getUserFromToken
