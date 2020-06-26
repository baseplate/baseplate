import {InvalidFieldSetError} from './errors'

export type FieldSetType = Array<string>

export default class FieldSet {
  static intersect(a: FieldSetType, b: FieldSetType): FieldSetType {
    if (!a) return b
    if (!b) return a

    const newFieldSet: FieldSetType = []

    a.forEach((item) => {
      if (b.includes(item)) {
        newFieldSet.push(item)
      }
    })

    return newFieldSet
  }

  static validate(fieldSet: FieldSetType) {
    const isValid =
      Array.isArray(fieldSet) &&
      fieldSet.every((item) => item && typeof item === 'string')

    if (!isValid) {
      throw new InvalidFieldSetError({fieldSet})
    }
  }

  static unite(a: FieldSetType, b: FieldSetType): FieldSetType {
    if (!a || !b) return

    const newFieldSet = new Set(a)

    b.forEach((item) => {
      newFieldSet.add(item)
    })

    return Array.from(newFieldSet)
  }
}
