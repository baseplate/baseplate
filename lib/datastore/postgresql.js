const {Client, Pool} = require('pg')
const {v4: uuid} = require('uuid')
const QueryFilter = require('../queryFilter')

const pool = new Pool({
  user: 'bp_dev',
  host: 'localhost',
  database: 'baseplate_dev',
  password: 'bp_dev',
  port: 5432
})

const OPERATORS_SINGLETON = {
  eq: '=',
  gt: '>',
  gte: '>=',
  in: 'IN',
  lt: '<',
  lte: '<=',
  ne: '<>',
  nin: 'IN'
}

class PostgreSQLStore {
  static encodeDecodeEntry(entry, type) {
    if (!entry) {
      return entry
    }

    return Object.entries(entry).reduce((entry, [name, value]) => {
      if (name === '_createdAt' || name === '_updatedAt') {
        const newValue = type === 'encode' ? new Date(value) : value.getTime()

        return {
          ...entry,
          [name]: newValue
        }
      }

      return {
        ...entry,
        [name]: value
      }
    }, {})
  }

  static getColumnNameFromFieldName(fieldName) {
    if (fieldName.startsWith('_')) {
      return `${fieldName}`
    }

    return `data->>'${fieldName}'`
  }

  static getColumnsFromEntry(entry) {
    const data = {}
    const internals = {}

    Object.entries(entry).forEach(([key, value]) => {
      if (key.startsWith('_')) {
        internals[key] = value
      } else {
        data[key] = value
      }
    })

    return {
      data,
      internals
    }
  }

  static getColumnsFromSchema(schema) {
    const baseColumns = {
      _id: 'varchar(36) PRIMARY KEY',
      _createdAt: 'timestamp',
      _updatedAt: 'timestamp',
      data: 'jsonb'
    }

    return baseColumns
  }

  static getOrderByFromSortObject(sortObject) {
    if (!sortObject) return

    const members = Object.entries(sortObject).map(([fieldName, value]) => {
      const column = PostgreSQLStore.getColumnNameFromFieldName(fieldName)
      const direction = value === 1 ? 'ASC' : 'DESC'

      return `${column} ${direction}`
    })

    return members.join(', ')
  }

  static getSQLFieldsFromFieldSet(fieldSet) {
    if (!fieldSet) {
      return ['*']
    }

    const fields = fieldSet.map(fieldName => {
      const columnName = PostgreSQLStore.getColumnNameFromFieldName(fieldName)

      return `${columnName} AS "${fieldName}"`
    })

    return fields
  }

  static getSQLFromQueryFilter(node, parameters) {
    if (!node) {
      return []
    }

    if (!parameters) {
      parameters = {
        count: 0,
        list: []
      }

      const query = PostgreSQLStore.getSQLFromQueryFilter(node, parameters)

      return [query, parameters.list]
    }

    if (node.type === 'fork') {
      const connector = node.operator === 'and' ? 'AND' : 'OR'
      const members = node.branches
        .map(branch =>
          PostgreSQLStore.getSQLFromQueryFilter(branch, parameters)
        )
        .filter(Boolean)
        .join(` ${connector} `)

      return `(${members})`
    }

    if (node.type === 'branch') {
      return Object.entries(node.fields)
        .map(([name, node]) => {
          const operator = OPERATORS_SINGLETON[node.operator]

          if (!operator) {
            return null
          }

          const value = Array.isArray(node.value) ? node.value : [node.value]
          const variables = value.map(valueNode => {
            const variable = `$${parameters.count + 1}`

            parameters.list[parameters.count] = valueNode
            parameters.count++

            return variable
          })
          const variableExpression =
            variables.length > 1 ? `(${variables.join(', ')})` : variables[0]
          const fieldName = PostgreSQLStore.getColumnNameFromFieldName(name)
          const comparison = `${fieldName} ${operator} ${variableExpression}`

          if (node.isNegated || node.operator === 'nin') {
            return `(NOT ${comparison})`
          }

          return comparison
        })
        .join(' AND ')
    }
  }

  static getTableName(modelName) {
    if (modelName.startsWith('_')) {
      return `internal${modelName}`
    }

    return `model_${modelName}`
  }

  async createOne({entry, modelName}) {
    const id = uuid()
    const tableName = PostgreSQLStore.getTableName(modelName)
    const {data, internals} = PostgreSQLStore.getColumnsFromEntry(entry)
    const payload = {
      _id: id,
      data: JSON.stringify(data),
      ...internals
    }
    const columns = Object.keys(payload)
      .map(key => `"${key}"`)
      .join(', ')
    const values = Object.keys(payload).map((_, index) => `$${index + 1}`)
    const query = `INSERT INTO ${tableName} (${columns}) VALUES(${values})`
    const parameters = Object.values(payload)

    await pool.query(query, parameters)

    return {
      _id: id,
      ...entry
    }
  }

  async delete({filter, modelName}) {
    const [
      filterQuery,
      filterParameters
    ] = PostgreSQLStore.getSQLFromQueryFilter(filter.root)
    const tableName = PostgreSQLStore.getTableName(modelName)
    const query = `DELETE FROM ${tableName} WHERE ${filterQuery}`
    const {rowCount: deleteCount} = await pool.query(query, filterParameters)

    return {deleteCount}
  }

  async deleteOneById({id, modelName}) {
    const filter = QueryFilter.parse({_id: id})

    return this.delete({filter, modelName})
  }

  async find({fieldSet, filter, modelName, pageNumber = 1, pageSize, sort}) {
    const tableName = PostgreSQLStore.getTableName(modelName)
    const [
      filterQuery,
      filterParameters
    ] = PostgreSQLStore.getSQLFromQueryFilter(filter.root)
    const fields = [
      PostgreSQLStore.getSQLFieldsFromFieldSet(fieldSet),
      'count(*) OVER() AS full_count'
    ]
    const queryNodes = [`SELECT ${fields.join(', ')} FROM ${tableName}`]
    const order = PostgreSQLStore.getOrderByFromSortObject(sort)

    if (filterQuery) {
      queryNodes.push(`WHERE ${filterQuery}`)
    }

    if (order) {
      queryNodes.push(`ORDER BY ${order}`)
    }

    if (pageSize) {
      queryNodes.push(`LIMIT ${pageSize} OFFSET ${(pageNumber - 1) * pageSize}`)
    }

    const query = queryNodes.join(' ')
    const {rows} = await pool.query(query, filterParameters)
    const results = rows.map(result => {
      const {data, full_count, ...internalFields} = result

      return {
        ...internalFields,
        ...data
      }
    })

    let count = 0

    if (rows.length > 0) {
      count = Number(rows[0].full_count)
    } else if (pageNumber > 1) {
      // In this case, we might not be getting any results because we're
      // paginating past the last record, in which case we don't get a
      // `full_count` column. The only way to provide an accurate count
      // in this situation is to run an extra query to that effect.
      const countQuery = await pool.query(`select count(*) from ${tableName}`)

      count = Number(countQuery.rows[0].count)
    }

    return {
      count,
      results
    }
  }

  async findManyById({fieldSet, filter, ids, modelName}) {
    const filterWithIds = QueryFilter.parse({_id: {$in: ids}}).intersectWith(
      filter
    )
    const {results} = await this.find({
      fieldSet,
      filter: filterWithIds,
      modelName
    })

    return results
  }

  async findOneById({fieldSet, filter, id, modelName}) {
    const filterWithIds = QueryFilter.parse({_id: id}).intersectWith(filter)
    const {results} = await this.find({
      fieldSet,
      filter: filterWithIds,
      modelName
    })

    return results[0] || null
  }

  async setupModel({schema}) {
    const tableName = PostgreSQLStore.getTableName(schema.name)
    const columns = PostgreSQLStore.getColumnsFromSchema(schema)
    const columnString = Object.entries(columns)
      .map(([name, description]) => `"${name}" ${description}`)
      .join(', ')
    const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnString});`

    return pool.query(query)
  }

  async update({filter, modelName, update}) {
    const tableName = PostgreSQLStore.getTableName(modelName)
    const {data, internals} = PostgreSQLStore.getColumnsFromEntry(update)
    const processedInternals = PostgreSQLStore.encodeDecodeEntry(
      internals,
      'encode'
    )
    const [
      filterQuery,
      filterParameters
    ] = PostgreSQLStore.getSQLFromQueryFilter(filter.root)
    const assignmentParameters = Object.values(processedInternals).concat(
      JSON.stringify(data)
    )
    const assignments = Object.keys(processedInternals).map(
      (fieldName, index) => {
        return `"${fieldName}" = $${index + filterParameters.length + 1}`
      }
    )

    assignments.push(`data = data || $${assignments.length + 2}`)

    const assignmentsQuery = assignments.join(', ')
    const query = `UPDATE ${tableName} SET ${assignmentsQuery} WHERE ${filterQuery} RETURNING *`
    const parameters = filterParameters.concat(assignmentParameters)
    const {rows} = await pool.query(query, parameters)
    const results = rows.map(row => {
      const {data, ...internals} = row

      return {
        ...internals,
        ...data
      }
    })

    return {results}
  }

  async updateOneById({id, modelName, update}) {
    const filter = QueryFilter.parse({_id: id})
    const {results} = await this.update({filter, modelName, update})

    return results[0] || null
  }
}

module.exports = PostgreSQLStore
