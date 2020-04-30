class FieldSet {
  static intersect(a, b) {
    if (!a) return b
    if (!b) return a

    const newFieldSet = []

    a.forEach(item => {
      if (b.includes(item)) {
        newFieldSet.push(item)
      }
    })

    return newFieldSet
  }

  static unite(a, b) {
    if (!a || !b) return

    const newFieldSet = new Set(a)

    b.forEach(item => {
      newFieldSet.add(item)
    })

    return Array.from(newFieldSet)
  }
}

module.exports = FieldSet
