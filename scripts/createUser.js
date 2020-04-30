const modelFactory = require('../lib/modelFactory')
const schemaStore = require('../lib/schemaStore')

const User = modelFactory(schemaStore.get('_user'))
const newUser = new User({
  accessLevel: process.env.BASEPLATE_ACCESS_LEVEL,
  username: process.env.BASEPLATE_USERNAME,
  password: process.env.BASEPLATE_PASSWORD
})

newUser
  .save()
  .then(response => {
    console.log('Done!')

    process.exit(0)
  })
  .catch(error => {
    console.error(error)

    process.exit(1)
  })
