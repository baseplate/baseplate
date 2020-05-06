const batcher = require('./batcher')
const MongoStore = require('./mongodb')
const PostgreSQLStore = require('./postgresql')

module.exports = () => {
  // const DataStore = batcher(MongoStore)

  // return new DataStore({
  //   connectionString: 'mongodb://localhost:27017',
  //   databaseName: 'baseplate-dev'
  // })

  return new PostgreSQLStore()
}
