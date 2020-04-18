function formatError(error) {
  if (Array.isArray(error.childErrors)) {
    return error.childErrors.map(childError => formatError(childError))
  }

  const formattedError = {}

  if (error.statusCode) {
    formattedError.status = error.statusCode
  }

  if (error.message) {
    formattedError.message = error.message
  }

  if (error.detail) {
    formattedError.detail = error.detail
  }

  return formattedError
}

class GraphQLError extends Error {
  constructor(error) {
    super(error.message)

    this.extensions = {
      errorDetails: formatError(error)
    }
  }
}

module.exports = GraphQLError
