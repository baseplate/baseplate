const {Pool} = require('pg')
const QueryFilter = require('../core/lib/queryFilter')

const pool = new Pool()

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

class PostgreSQL {
  static async $__createOne({entry}) {
    const tableName = this.$__getTableName()
    const {data, internals} = this.$__getColumnsFromEntry(entry)
    const payload = {
      data,
      ...internals
    }
    const columns = Object.keys(payload)
      .map(key => `"${key}"`)
      .join(', ')
    const values = Object.keys(payload).map((_, index) => `$${index + 1}`)
    const query = `INSERT INTO ${tableName} (${columns}) VALUES(${values}) RETURNING _id`
    const {rows} = await pool.query(query, Object.values(payload))

    return {
      _id: rows[0]._id,
      ...entry
    }
  }

  static async $__delete({filter, Model}) {
    const [filterQuery, filterParameters] = this.$__getSQLCondition(filter.root)
    const tableName = this.$__getTableName(Model)
    const query = `DELETE FROM ${tableName} WHERE ${filterQuery}`
    const {rowCount: deleteCount} = await pool.query(query, filterParameters)

    return {deleteCount}
  }

  static async $__deleteOneById({id, Model}) {
    const filter = QueryFilter.parse({_id: id})

    return this.delete({filter, Model})
  }

  static $__encodeDecodeEntry(entry, type) {
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

  static async $__find({fieldSet, filter, pageNumber = 1, pageSize, sort}) {
    const tableName = this.$__getTableName()
    const [filterQuery, filterParameters] = this.$__getSQLCondition(
      filter && filter.root
    )
    const fields = [
      this.$__getFieldProjection(fieldSet),
      'count(*) OVER() AS full_count'
    ]
    const queryNodes = [`SELECT ${fields.join(', ')} FROM ${tableName}`]
    const order = this.$__getOrderByFromSortObject(sort)

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

  static async $__findManyById({fieldSet, filter, ids}) {
    const filterWithIds = QueryFilter.parse({_id: {$in: ids}}).intersectWith(
      filter
    )
    const {results} = await this.find({
      fieldSet,
      filter: filterWithIds
    })

    return results
  }

  static async $__findOneById({fieldSet, filter, id}) {
    const filterWithIds = QueryFilter.parse({_id: id}).intersectWith(filter)
    const {results} = await this.$__find({
      fieldSet,
      filter: filterWithIds
    })

    return results[0] || null
  }

  static $__getColumnName({fieldName, getJSONAsText}) {
    if (fieldName.startsWith('_')) {
      return `${fieldName}`
    }

    const fieldPath = fieldName.split('.')

    if (fieldPath.length > 1) {
      const operator = getJSONAsText ? '#>>' : '#>'

      return `data${operator}'{${fieldPath.join(',')}}'`
    }

    const operator = getJSONAsText ? '->>' : '->'

    return `data${operator}'${fieldPath[0]}'`
  }

  static $__getColumnsFromEntry(entry) {
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

  static $__getFieldProjection(fieldSet) {
    if (!fieldSet) {
      return ['*']
    }

    const fields = fieldSet.map(fieldName => {
      const columnName = this.$__getColumnName({fieldName})

      return columnName === fieldName
        ? `"${columnName}"`
        : `${columnName} AS "${fieldName}"`
    })

    return fields
  }

  static $__getOrderByFromSortObject(sortObject) {
    if (!sortObject) return

    const members = Object.entries(sortObject).map(([fieldName, value]) => {
      const column = this.$__getColumnName({
        fieldName,
        getJSONAsText: true
      })
      const direction = value === 1 ? 'ASC' : 'DESC'

      return `${column} ${direction}`
    })

    return members.join(', ')
  }

  static $__getSQLCondition(node, parameters) {
    if (!node) {
      return []
    }

    if (!parameters) {
      parameters = []

      const query = this.$__getSQLCondition(node, parameters)

      return [query, parameters]
    }

    if (node.type === 'fork') {
      const connector = node.operator === 'and' ? 'AND' : 'OR'
      const members = node.branches
        .map(branch => this.$__getSQLCondition(branch, parameters))
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
            parameters.push(valueNode)

            return `$${parameters.length}`
          })
          const variableExpression =
            variables.length > 1 ? `(${variables.join(', ')})` : variables[0]
          const fieldName = this.$__getColumnName({
            fieldName: name,
            getJSONAsText: true
          })
          const comparison = `${fieldName} ${operator} ${variableExpression}`

          if (node.isNegated || node.operator === 'nin') {
            return `(NOT ${comparison})`
          }

          return comparison
        })
        .join(' AND ')
    }
  }

  static $__getTableName() {
    if (this.isBaseModel) {
      return this.handle
    }

    return `model_${this.handle}`
  }

  static $__getTableSchema(schema) {
    const baseColumns = {
      _id: 'uuid PRIMARY KEY DEFAULT uuid_generate_v4 ()',
      _createdAt: 'timestamp',
      _updatedAt: 'timestamp',
      data: 'jsonb'
    }

    return baseColumns
  }

  static async $__setup() {
    const tableName = this.$__getTableName(this)
    const columns = this.$__getTableSchema(this.schema)
    const columnString = Object.entries(columns)
      .map(([name, description]) => `"${name}" ${description}`)
      .join(', ')
    const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnString});`

    return pool.query(query)
  }

  static async $__update({filter, update}) {
    const tableName = this.$__getTableName()
    const {data, internals} = this.$__getColumnsFromEntry(update)
    const processedInternals = this.$__encodeDecodeEntry(internals, 'encode')
    const [filterQuery, filterParameters] = this.$__getSQLCondition(filter.root)
    const assignments = [`data = data || $${filterParameters.length + 1}`]
    const assignmentParameters = [data]

    Object.keys(processedInternals).forEach((fieldName, index) => {
      const variable = `$${filterParameters.length + index + 1}`

      assignments.push(`"${fieldName}" = ${variable}`)
      assignmentParameters.push(processedInternals[fieldName])
    })

    const assignmentsQuery = assignments.join(', ')
    const query = `UPDATE ${tableName} SET ${assignmentsQuery} WHERE ${filterQuery} RETURNING *`
    const {rows} = await pool.query(query, [
      ...filterParameters,
      ...assignmentParameters
    ])
    const results = rows.map(row => {
      const {data, ...internals} = row

      return {
        ...internals,
        ...data
      }
    })

    return {results}
  }

  static async $__updateOneById({id, update}) {
    const filter = QueryFilter.parse({_id: id})
    const {results} = await this.$__update({filter, update})

    return results[0] || null
  }
}

module.exports = PostgreSQL
