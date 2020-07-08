import modelStore from '../modelStore/'
import TokenData from './tokenData'

const getUserFromToken = (tokenData: TokenData) => {
  if (!tokenData) return

  const {id, level, model} = tokenData
  const User = modelStore.get(model)

  if (!User) return

  return new User({
    _id: id,
    accessLevel: level,
  })
}

export default getUserFromToken
