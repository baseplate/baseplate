const config = require('../serverless.json')

Object.entries(config.provider.environment).forEach(([key, value]) => {
  process.env[key] = value
})

const modelStore = require('../lib/modelStore')
const userInternalModel = require('../lib/internalModels/user')

modelStore.add(userInternalModel, {loadFieldHandlers: true})

const User = modelStore.get('base_user')
const newUser = new User({
  accessLevel: process.env.BASEPLATE_ACCESS_LEVEL,
  username: process.env.BASEPLATE_USERNAME,
  password: process.env.BASEPLATE_PASSWORD
})

newUser
  .save()
  .then(() => {
    console.log('Done!')

    process.exit(0)
  })
  .catch(error => {
    console.error(error)

    process.exit(1)
  })
