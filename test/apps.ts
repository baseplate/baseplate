import * as mongoDBApp from '../packages/mongodb'

import Author from './models/Author'
import Book from './models/Book'
import Genre from './models/Genre'

mongoDBApp.initialize([Author, Book, Genre], {
  database: {
    name: global.__MONGO_DB_NAME__,
    uri: global.__MONGO_URI__,
  },
})

export default [['@baseplate/mongodb', mongoDBApp]]
export type App = typeof mongoDBApp
