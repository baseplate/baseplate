import {CustomError} from '@baseplate/schema'

type FormattedError =
  | {
      detail?: string
      message?: string
      status?: number
    }
  | Array<FormattedError>

function formatError(error: CustomError): FormattedError {
  if (Array.isArray(error.childErrors)) {
    return error.childErrors.map((childError) => formatError(childError))
  }

  const formattedError: FormattedError = {}

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

export default class GraphQLError extends Error {
  extensions: Record<string, FormattedError>

  constructor(error: CustomError) {
    super(error.message)

    this.extensions = {
      errorDetails: formatError(error),
    }
  }
}
