const batcher = require('./batcher')
const MongoStore = require('./mongodb')
//const PostgreSQLStore = require('./postgresql')

module.exports = () => {
  const DataStore = batcher(MongoStore)

  return new DataStore()

  //return new PostgreSQLStore()
}
