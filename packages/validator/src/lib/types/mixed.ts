import {BaseHandler} from '../field'

export default class FieldMixed extends BaseHandler {
  cast({path, value}: {path: string[]; value: any}) {
    return value
  }
}
