import {InvalidFieldSetError} from './errors'

export default class FieldSet {
  fields: Set<string>

  constructor(fields: Set<string> = new Set()) {
    this.fields = fields
  }

  static fromArray(input: Array<string>) {
    return new this(new Set(input))
  }

  static intersect(a: FieldSet, b: FieldSet): FieldSet {
    if (!a) return b
    if (!b) return a

    const fields = new Set(a.fields)

    a.fields.forEach((item) => {
      if (b.fields.has(item)) {
        fields.add(item)
      }
    })

    return new this(fields)
  }

  static unite(a: FieldSet, b: FieldSet): FieldSet {
    if (!a || !b) return

    const fields = new Set(a.fields)

    b.fields.forEach((item) => {
      fields.add(item)
    })

    return new this(fields)
  }

  has(fieldName: string) {
    return this.fields.has(fieldName)
  }

  toArray() {
    return Array.from(this.fields)
  }

  validate() {
    const isValid = Array.from(this.fields).every(
      (item) => item && typeof item === 'string'
    )

    if (!isValid) {
      throw new InvalidFieldSetError({fieldSet: this})
    }

    return this
  }
}
