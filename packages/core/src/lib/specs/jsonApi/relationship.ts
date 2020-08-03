import {CustomError} from '@baseplate/validator'
import FieldSet from '../../fieldSet'
import {LinksBlock} from './entry'
import JsonApiModel from './model'

export type IncludeMap = Record<string, any>

export interface IncludedRelationship {
  entry?: JsonApiModel
  error?: CustomError
  fieldSet?: FieldSet
}

export interface Relationship {
  data: RelationshipData | Array<RelationshipData>
  links: LinksBlock
}

export interface RelationshipData {
  id: string
  type: string
}
