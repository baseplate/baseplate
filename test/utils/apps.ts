import * as mongoDBApp from '../../packages/mongodb/dist'

import Author from '../models/Author'
import Book from '../models/Book'
import Genre from '../models/Genre'

mongoDBApp.initialize([Author, Book, Genre], {
  database: {
    name: global.__MONGO_DB_NAME__,
    uri: global.__MONGO_URI__,
  },
})

const apps = [['@baseplate/mongodb', mongoDBApp]]

export type App = typeof mongoDBApp

export function forEachApp(callback: Function) {
  describe.each(apps)('%s', (name: string, app: App) => {
    callback(app)
  })
}
