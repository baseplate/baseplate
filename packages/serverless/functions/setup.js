const createDatastore = require('../lib/datastore/factory')
const modelStore = require('../lib/modelStore')

module.exports.handler = async () => {
  const requestContext = {
    datastore: createDatastore()
  }
  const models = modelStore.getAll({context: requestContext})
  const setup = models.map(Model => {
    return typeof Model.setup === 'function' ? Model.setup() : null
  })

  await Promise.all(setup)

  return {
    statusCode: 200
  }
}
