const fs = require('fs')
const path = require('path')

module.exports = (directoryPath, {extensions = ['.js']} = {}) => {
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
          source,
        }
      })
      .filter(Boolean)

    return sourceFiles
  } catch {
    return []
  }
}
