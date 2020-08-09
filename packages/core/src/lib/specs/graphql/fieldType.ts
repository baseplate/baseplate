import type BaseModel from '../../model/base'
import {FieldHandler} from '@baseplate/validator'
import type GraphQL from 'graphql'

export abstract class GraphQLFieldHandler extends FieldHandler {
  abstract getGraphQLInputType(
    graphql: typeof GraphQL,
    fieldName: string,
    Model: typeof BaseModel
  ): {type: any}
  abstract getGraphQLOutputType(
    graphql: typeof GraphQL,
    fieldName: string,
    Model: typeof BaseModel
  ): {type: any}
}
