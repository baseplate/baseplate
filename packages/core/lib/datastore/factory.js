const batcher = require('./batcher')
const DatabaseEngine = require(process.env.DATABASE_PACKAGE ||
  '../../../postgres/')

module.exports = () => {
  return batcher(DatabaseEngine)

  return DatabaseEngine
}
