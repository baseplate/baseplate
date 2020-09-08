import {camelize} from 'inflected'
import {
  FieldCastQueryParameters,
  FieldConstructorParameters,
  FieldValidationError,
  types,
} from '@baseplate/schema'
import type GraphQL from 'graphql'

import AccessModel from '../internalModels/access'
import BaseModel from '../model/base'
import Context from '../context'
import FieldSet from '../fieldSet'
import {InvalidQueryFilterParameterError} from '../errors'
import isPlainObject from '../utils/isPlainObject'
import modelStore from '../modelStore'
import QueryFilter from '../queryFilter/'
import QueryFilterField from '../queryFilter/field'

export default class CoreFieldReference extends types.FieldReference {
  models: Array<typeof BaseModel>

  constructor(props: FieldConstructorParameters) {
    super(props)

    this.models = props.children.map(({type}: {type: string}) =>
      modelStore.get(type)
    )
  }

  cast({path, value}: {path: string[]; value: any}): BaseModel {
    console.log(
      '-----> REF CAST',
      this.models,
      value,
      value instanceof BaseModel
    )
    const acceptedModelNames = this.modelNames.join(', ')

    if (value instanceof BaseModel) {
      const isValidModel = this.models.some((Model) => value instanceof Model)

      console.log('------> isValidModel', value, isValidModel)

      if (!isValidModel) {
        throw new FieldValidationError({path, type: acceptedModelNames})
      }

      return value
    }

    if (isPlainObject(value) || typeof value === 'string') {
      let id
      let Model

      if (typeof value === 'string') {
        if (this.models.length > 1) {
          throw new FieldValidationError({path, type: acceptedModelNames})
        }

        id = value
        Model = this.models[0]
      } else {
        id = value.id
        Model = this.models.find((Model) => Model.base$handle === value.type)
      }

      if (!Model) {
        throw new FieldValidationError({path, type: acceptedModelNames})
      }

      return new Model({_id: id})
    }

    throw new FieldValidationError({path, type: acceptedModelNames})
  }

  async castQuery({
    context,
    field,
    path,
  }: {
    context: Context
    field: QueryFilterField
    path: string[]
  }) {
    if (typeof field.value === 'string') {
      const newField = field.clone()
      const value = this.models.map((Model) => new Model({_id: field.value}))

      if (value.length > 1) {
        newField.operator = field.operator === 'ne' ? 'nin' : 'in'
        newField.value = value
      } else {
        newField.value = value[0]
      }

      return newField
    }

    if (isPlainObject(field.value)) {
      const newField = field.clone()
      const ops = this.models.map((Model) =>
        Model.find({
          context,
          fieldSet: new FieldSet(),
          filter: new QueryFilter(field.value),
          user: context.get('base$user'),
        })
      )
      const opResults = await Promise.all(ops)
      const value = opResults.reduce(
        (entries, op) => entries.concat(op.entries),
        []
      )

      if (value.length > 1) {
        newField.operator = field.operator === 'ne' ? 'nin' : 'in'
        newField.value = value
      } else {
        newField.value = value[0]
      }

      return newField
    }

    return field
  }

  deserialize(value: any): BaseModel {
    if (!value) return null

    const Model = modelStore.get(value.type)

    const a = new Model({_id: value.id})

    console.log('-------> DESERIALIZE', value, a instanceof BaseModel)

    return a
  }

  // (!) TO DO
  getGraphQLInputType(graphql: typeof GraphQL, fieldName: string) {
    return {
      type: graphql.GraphQLString,
    }
  }

  getGraphQLOutputType(
    graphql: typeof GraphQL,
    fieldName: string,
    Model: typeof BaseModel
  ) {
    const isMultiple =
      Array.isArray(this.options) || Array.isArray(this.options.type)
    const type =
      this.models.length === 1
        ? this.models[0].base$graphQL.objectType
        : new graphql.GraphQLUnionType({
            name: camelize(`${Model.base$handle}_${fieldName}_output`),
            types: this.models.map((Model) => Model.base$graphQL.objectType),
          })
    const resolve = async (root: any, args: object, context: Context) => {
      const references = root[fieldName]

      if (!references) return null

      const referencesArray = Array.isArray(references)
        ? references
        : [references]
      const referenceModels = referencesArray.map(async ({id, type}) => {
        if (
          !id ||
          !type ||
          typeof id !== 'string' ||
          typeof type !== 'string'
        ) {
          return null
        }

        const ReferencedModel = this.models.find(
          (Model) => Model.base$handle === type
        )

        if (!ReferencedModel) {
          return null
        }

        const Access = <typeof AccessModel>modelStore.get('base$access')
        const access = await Access.getAccess({
          accessType: 'read',
          context,
          modelName: ReferencedModel.base$handle,
          user: context.get('base$user'),
        })

        if (access.toObject() === false) {
          return null
        }

        const filter = new QueryFilter({_id: id}).intersectWith(access.filter)

        return ReferencedModel.findOne({
          context,
          fieldSet: access.fields,
          filter,
          user: context.get('base$user'),
        })
      })
      const entries = await Promise.all(referenceModels)
      const objects = entries
        .filter(Boolean)
        .map((entry) => entry.toObject({includeModelInstance: true}))

      return isMultiple ? objects : objects[0]
    }

    return {
      type: isMultiple ? new graphql.GraphQLList(type) : type,
      resolve,
    }
  }

  serialize({value}: {value: any}) {
    return {
      id: value.id,
      type: (<typeof BaseModel>value.constructor).base$handle,
    }
  }
}
