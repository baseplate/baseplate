import {Relationship} from './relationship'

export default interface JsonApiEntry {
  type: string
  id: string
  attributes?: Record<string, any>
  meta?: MetaBlock
  links?: LinksBlock
  relationships?: Record<string, Relationship>
}

export interface LinksBlock {
  first?: string
  last?: string
  next?: string
  prev?: string
  self: string
}

export interface MetaBlock {
  count?: number
  links?: LinksBlock
  pageSize?: number
  totalPages?: number
  [propName: string]: any
}
