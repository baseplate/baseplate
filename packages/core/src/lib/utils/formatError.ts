import {CustomError} from '@baseplate/validator'

type FormattedError = {
  detail?: string
  source?: {pointer: string}
  status?: number
  title?: string
}

export default function formatError(
  error: CustomError
): FormattedError | Array<FormattedError> {
  if (error.childErrors) {
    return error.childErrors.reduce(
      (acc, childError) => acc.concat(formatError(childError)),
      []
    )
  }

  const formattedError: FormattedError = {}

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
      pointer: error.path.join('/'),
    }
  }

  return formattedError
}
