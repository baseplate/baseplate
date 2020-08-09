import {CastError, FieldValidationError} from '../errors'
import {
  BaseConstructorParameters,
  BaseHandler,
  BaseOptions,
  CastParameters,
  ValidateParameters,
} from '../field'

export default class FieldObject extends BaseHandler {
  cast({path, value}: CastParameters<object>) {
    return value
  }

  validate({path, value}: ValidateParameters<object>) {}
}
