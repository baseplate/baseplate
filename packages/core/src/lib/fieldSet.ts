import {InvalidFieldSetError} from './errors'

export default class FieldSet extends Set {
  constructor(fields: Set<string> | Array<string>) {
    super(Array.from(fields))
  }

  static intersect(a: FieldSet, b: FieldSet): FieldSet {
    if (!a) return b
    if (!b) return a

    const fields = new Set(a)

    a.forEach((item) => {
      if (b.has(item)) {
        fields.add(item)
      }
    })

    return new this(fields)
  }

  static unite(a: FieldSet, b: FieldSet): FieldSet {
    if (!a || !b) return

    const fields = new Set(a)

    b.forEach((item) => {
      fields.add(item)
    })

    return new this(fields)
  }

  toArray() {
    return Array.from(this)
  }

  validate() {
    const isValid = Array.from(this).every(
      (item) => item && typeof item === 'string'
    )

    if (!isValid) {
      throw new InvalidFieldSetError({fieldSet: this})
    }

    return this
  }
}
