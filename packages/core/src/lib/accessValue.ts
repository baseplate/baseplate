import {InvalidAccessValueError} from './errors'
import FieldSet from './fieldSet'
import QueryFilter from './queryFilter'

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

  constructor({absolute, fields, filter}: AccessValueParams) {
    this.absolute = absolute
    this.fields = fields
    this.filter = filter
  }

  static intersect(a: AccessValue, b: AccessValue): AccessValue {
    if (!a) return b
    if (!b) return a

    if (a.absolute === false || b.absolute === false) {
      return new this({
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

    return new this({
      absolute,
      fields,
      filter,
    })
  }

  static parse(
    values: any,
    filterPrefix: string = '$',
    isUnion: boolean = false
  ): AccessValue {
    if (!Array.isArray(values)) {
      return this.parseValue(values, filterPrefix)
    }

    const a = this.parseValue(values[0], filterPrefix)
    const b = this.parseValue(values[1], filterPrefix)

    return isUnion ? this.unite(a, b) : this.intersect(a, b)
  }

  static parseValue(value: any = false, filterPrefix: string): AccessValue {
    if (!value || typeof value === 'boolean') {
      return new this({absolute: Boolean(value)})
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

    const filter = value.filter && QueryFilter.parse(value.filter, filterPrefix)

    return new this({fields, filter})
  }

  static unite(a: AccessValue, b: AccessValue): AccessValue {
    if (!a || a.absolute === false) return b
    if (!b || b.absolute === false) return a

    if (a.absolute === true || b.absolute === true) {
      return new this({
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

    return new this({
      absolute,
      fields,
      filter,
    })
  }

  toObject(filterPrefix: string = '$'): AccessValueObject {
    if (typeof this.absolute === 'boolean') {
      return this.absolute
    }

    const object: AccessValueObject = {}

    if (this.filter) {
      object.filter = this.filter.toObject(filterPrefix)
    }

    if (this.fields) {
      object.fields = this.fields
    }

    return object
  }
}
