import {CustomError} from '@baseplate/validator'

import type BaseModel from '../../model/base'
import FieldSet from '../../fieldSet'
import {LinksBlock} from './entry'

export type IncludeMap = Record<string, any>

export interface IncludedRelationship {
  entry?: BaseModel
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
