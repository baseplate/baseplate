import {camelize} from 'inflected'
import {FieldHandler, types} from '@baseplate/validator'
import type GraphQL from 'graphql'

import AccessModel from '../internalModels/access'
import type BaseModel from '../model/base'
import Context from '../context'
import {GraphQLFieldHandler} from '../specs/graphql/fieldType'
import modelStore from '../modelStore'

export default class CoreFieldObject extends types.FieldObject {
  buildGraphQLObjectType(
    graphql: typeof GraphQL,
    fieldName: string,
    Model: typeof BaseModel,
    type: 'input' | 'output'
  ) {
    const functionName =
      type === 'input' ? 'getGraphQLInputType' : 'getGraphQLOutputType'
    const ObjectType =
      type === 'input'
        ? graphql.GraphQLInputObjectType
        : graphql.GraphQLObjectType
    const children = Object.keys(this.children).reduce(
      (children, fieldName) => {
        const child = this.children[fieldName]

        if (!(child instanceof FieldHandler)) {
          return children
        }

        const graphQLHandler = child as GraphQLFieldHandler

        return {
          ...children,
          [fieldName]: graphQLHandler[functionName](graphql, fieldName, Model),
        }
      },
      {}
    )

    const name = camelize(
      [Model.base$handle].concat(this.path).concat(type).join('_')
    )

    return {
      type: new ObjectType({
        fields: children,
        name,
      }),
    }
  }

  getGraphQLInputType(
    graphql: typeof GraphQL,
    fieldName: string,
    Model: typeof BaseModel
  ) {
    return this.buildGraphQLObjectType(graphql, fieldName, Model, 'input')
  }

  getGraphQLOutputType(
    graphql: typeof GraphQL,
    fieldName: string,
    Model: typeof BaseModel
  ) {
    return this.buildGraphQLObjectType(graphql, fieldName, Model, 'output')
  }
}
