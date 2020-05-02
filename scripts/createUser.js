const modelStore = require('../lib/modelStore')

const User = modelStore.get('_user')
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
