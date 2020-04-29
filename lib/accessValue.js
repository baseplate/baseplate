const FieldSet = require('./fieldSet')

class AccessValue {
  constructor({absolute, fields, filter}) {
    this.absolute = absolute
    this.fields = fields
    this.filter = filter
  }

  static intersect(a, b) {
    if (!a) return b
    if (!b) return a

    if (a.absolute === false || b.absolute === false) {
      return new this({
        absolute: false
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
      filter
    })
  }

  static parse(values, {isUnion = false} = {}) {
    if (!Array.isArray(values)) {
      return this.parseValue(values)
    }

    const a = this.parseValue(values[0])
    const b = this.parseValue(values[1])

    return isUnion ? this.unite(a, b) : this.intersect(a, b)
  }

  static parseValue(value = false) {
    const absolute =
      !value || typeof value === 'boolean' ? Boolean(value) : undefined
    const fields = Array.isArray(value.fields) ? value.fields : undefined
    const filter = value.filter

    return new this({absolute, fields, filter})
  }

  static unite(a, b) {
    if (!a || a.absolute === false) return b
    if (!b || b.absolute === false) return a

    if (a.absolute === true || b.absolute === true) {
      return new this({
        absolute: true
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
      filter
    })
  }

  isDenied() {
    return this.absolute === false
  }
}

module.exports = AccessValue
