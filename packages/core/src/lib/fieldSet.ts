import {InvalidFieldSetError} from './errors'

export default class FieldSet extends Set {
  constructor(fields: Set<string> | Array<string> = []) {
    super(Array.from(fields))
  }

  static intersect(a: FieldSet, b: FieldSet): FieldSet {
    if (!a) return b
    if (!b) return a

    return new this(a).intersectWith(b)
  }

  static unite(a: FieldSet, b: FieldSet): FieldSet {
    if (!a || !b) return

    return new this(a).uniteWith(b)
  }

  intersectWith(subject: FieldSet) {
    this.forEach((item) => {
      if (!subject.has(item)) {
        this.delete(item)
      }
    })

    return this
  }

  toArray() {
    return Array.from(this)
  }

  uniteWith(subject: FieldSet) {
    subject.forEach((item) => {
      this.add(item)
    })

    return this
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
