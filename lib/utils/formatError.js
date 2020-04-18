module.exports = function formatError(error) {
  if (error.childErrors) {
    return error.childErrors.reduce(
      (acc, childError) => acc.concat(formatError(childError)),
      []
    )
  }

  const formattedError = {}

  if (error.statusCode) {
    formattedError.status = error.statusCode
  }

  if (error.message) {
    formattedError.title = error.message
  }

  if (error.detail) {
    formattedError.detail = error.detail
  }

  if (error.path) {
    formattedError.source = {
      pointer: error.path.join('/')
    }
  }

  return formattedError
}
