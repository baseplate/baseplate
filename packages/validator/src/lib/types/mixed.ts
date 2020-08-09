import {BaseHandler} from '../field'

export default class FieldMixed extends BaseHandler {
  cast({path, value}: {path: Array<string>; value: any}) {
    return value
  }
}
