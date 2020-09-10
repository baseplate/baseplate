import {InvalidAccessValueError} from './errors'
import FieldSet from './fieldSet'
import QueryFilter from './queryFilter/'

type AccessValueObject =
  | boolean
  | {
      fields?: FieldSet
      filter?: object
    }

type AccessValueParams = {
  absolute?: boolean
  fields?: FieldSet
  filter?: QueryFilter
}

export class AccessValue {
  absolute: boolean
  fields: FieldSet
  filter: QueryFilter

  constructor(value?: any, filterPrefix: string = '$') {
    if (value !== undefined) {
      const {absolute, fields, filter} = this.parse(value, filterPrefix)

      this.absolute = absolute
      this.fields = fields
      this.filter = filter
    }
  }

  static fromInternals({absolute, fields, filter}: AccessValueParams) {
    const instance = new this()

    instance.absolute = absolute
    instance.fields = fields
    instance.filter = filter

    return instance
  }

  static intersect(a: AccessValue, b: AccessValue): AccessValue {
    if (!a) return b
    if (!b) return a

    if (a.absolute === false || b.absolute === false) {
      return this.fromInternals({
        absolute: false,
      })
    }

    let fields = a.fields

    if (b.fields) {
      fields = fields ? FieldSet.intersect(fields, b.fields) : b.fields
    }

    let filter = a.filter

    if (b.filter) {
      filter = filter ? filter.intersectWith(b.filter) : b.filter
    }

    const absolute = !filter && !fields ? true : undefined

    return this.fromInternals({
      absolute,
      fields,
      filter,
    })
  }

  static unite(a: AccessValue, b: AccessValue): AccessValue {
    if (!a || a.absolute === false) return b
    if (!b || b.absolute === false) return a

    if (a.absolute === true || b.absolute === true) {
      return this.fromInternals({
        absolute: true,
      })
    }

    let fields = a.fields

    if (fields && b.fields) {
      fields = FieldSet.unite(fields, b.fields)
    }

    let filter = a.filter

    if (filter && b.filter) {
      filter = filter.uniteWith(b.filter)
    }

    const absolute = !filter && !fields ? true : undefined

    return this.fromInternals({
      absolute,
      fields,
      filter,
    })
  }

  parse(value: any = false, filterPrefix: string): AccessValueParams {
    if (!value || typeof value === 'boolean') {
      return {absolute: Boolean(value)}
    }

    if (!value.fields && !value.filter) {
      throw new InvalidAccessValueError({accessValue: value})
    }

    const hasInvalidKey = Object.keys(value).some(
      (key) => !['fields', 'filter'].includes(key)
    )

    if (hasInvalidKey) {
      throw new InvalidAccessValueError({accessValue: value})
    }

    let fields

    if (value.fields) {
      fields = new FieldSet(value.fields).validate()
    }

    const filter = value.filter && new QueryFilter(value.filter, filterPrefix)

    return {fields, filter}
  }

  toObject(filterPrefix: string = '$'): AccessValueObject {
    if (typeof this.absolute === 'boolean') {
      return this.absolute
    }

    const object: AccessValueObject = {}

    if (this.filter) {
      object.filter = this.filter.toObject({operatorPrefix: filterPrefix})
    }

    if (this.fields) {
      object.fields = this.fields
    }

    return object
  }
}
