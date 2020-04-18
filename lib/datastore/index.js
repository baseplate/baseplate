const MongoStore = require('./mongodb')

module.exports = new MongoStore({
  connectionString: 'mongodb://localhost:27017',
  databaseName: 'baseplate-dev'
})
