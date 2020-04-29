const batcher = require('./batcher')
const MongoStore = require('./mongodb')

module.exports = () => {
  const DataStore = batcher(MongoStore)

  return new DataStore({
    connectionString: 'mongodb://localhost:27017',
    databaseName: 'baseplate-dev'
  })
}
