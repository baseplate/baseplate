import BaseModel from '../../model/base'
import JsonApiEntry from './entry'

export default abstract class JsonApiModel extends BaseModel {
  abstract base$jsonApiPostFormat(
    formattedEntry: JsonApiEntry,
    entry: BaseModel
  ): JsonApiEntry
}
