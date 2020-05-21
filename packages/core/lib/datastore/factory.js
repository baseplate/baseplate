const batcher = require('./batcher')
const DatabaseEngine = require(process.env.DATABASE_PACKAGE ||
  '../../../postgres/')

module.exports = () => {
  // const DataStore = batcher(PostgreSQLStore)

  return new DatabaseEngine()
}
