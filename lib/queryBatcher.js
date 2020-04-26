const DataLoader = require('dataloader')

const FieldSet = require('./fieldSet')

class QueryBatcher {
  constructor(Model) {
    this.Model = Model

    this.findByIdBatcher = new DataLoader(this.processFindByIdBatch.bind(this))
  }

  findById(props) {
    return this.findByIdBatcher.load(props)
  }

  async processFindByIdBatch(items) {
    const filterHash = {}

    items.forEach((item, index) => {
      const filter = item.filter && JSON.stringify(item.filter.toObject('$'))

      filterHash[filter] = (filterHash[filter] || []).concat(index)
    })

    const results = []

    await Promise.all(
      Object.values(filterHash).map(async indexes => {
        const {filter} = items[indexes[0]]
        const ids = indexes.map(index => items[index].id)
        const fieldSet = indexes.reduce(
          (result, index) => FieldSet.unite(result, items[index].fieldSet),
          undefined
        )
        const data = await this.Model.batchFindById({fieldSet, filter, ids})

        indexes.forEach(index => {
          results[index] = data[index]
        })
      })
    )

    return results
  }
}

module.exports = QueryBatcher
