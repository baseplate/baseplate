import fs from 'fs'
import path from 'path'

import logger from '../logger'

export default function requireDirectory(
  directoryPath: string,
  extensions = ['.js']
) {
  try {
    const fileNames = fs.readdirSync(directoryPath)
    const sourceFiles = fileNames
      .map((fileName) => {
        if (!extensions.includes(path.extname(fileName))) {
          return null
        }

        const source = require(path.join(directoryPath, fileName))
        const name = path.basename(fileName, '.js')

        return {
          name,

          // (!) TO DO: Find a better way of accounting for different module
          // types.
          source: source.default ? source.default : source,
        }
      })
      .filter(Boolean)

    return sourceFiles
  } catch (error) {
    logger.error(error)

    return []
  }
}
