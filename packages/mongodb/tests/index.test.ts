import * as app from '../dist'
import runCoreTests from '../../core/tests'

runCoreTests(app, {
  database: {
    name: global.__MONGO_DB_NAME__,
    uri: global.__MONGO_URI__,
  },
})
