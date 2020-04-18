class GenericJsonResponse {
  constructor({data, errors, statusCode, url}) {
    this.data = data
    this.statusCode = statusCode
    this.url = url

    if (errors) {
      this.errors = Array.isArray(errors) ? errors : [errors]
    }
  }

  buildErrorResponse() {
    return {
      errors: this.errors.reduce((result, error) => {
        return result.concat(this.formatError(error))
      }, [])
    }
  }

  format() {
    const responseBody = this.errors ? this.buildErrorResponse() : this.data
    const isEmptyResponse = Object.keys(responseBody).length === 0

    if (isEmptyResponse) {
      this.statusCode = 204

      return null
    }

    return responseBody
  }

  formatError(error) {
    if (error.childErrors) {
      return error.childErrors.reduce(
        (acc, childError) => acc.concat(this.formatError(childError)),
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

  async toObject() {
    const data = this.format()

    return {
      statusCode:
        data && data.errors ? data.errors[0].status || 500 : this.statusCode,
      body: JSON.stringify(data, null, 2)
    }
  }
}

module.exports = GenericJsonResponse
