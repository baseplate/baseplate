import GenericModel from '../../model/generic'
import JsonApiEntry from './entry'

export default abstract class ModelWithJsonApiMethods extends GenericModel {
  abstract base$jsonApiPostFormat(
    formattedEntry: JsonApiEntry,
    entry: GenericModel
  ): JsonApiEntry
}
