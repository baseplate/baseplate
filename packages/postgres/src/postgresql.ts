import {Pool} from 'pg'
import ModelInterface, {
  FindManyByIdParameters,
  FindOneByIdParameters,
  FindParameters,
} from '../../core/dist/lib/model/interface'
import QueryFilter, {
  Branch as QueryFilterBranch,
  Fork as QueryFilterFork,
  Field as QueryFilterField,
} from '@baseplate/core/dist/lib/queryFilter'
import {FieldSetType} from '@baseplate/core/src/lib/fieldSet'
import SortObject from '@baseplate/core/src/lib/sortObject'

const pool = new Pool()

type Fields = Record<string, any>
type SQLParameter = Array<any>

export default class PostgreSQL extends ModelInterface {
  static async $__dbCreateOne(entry: PostgreSQL) {
    const tableName = this.$__postgresGetTableName()
    const {data, internals} = this.$__postgresGetColumnsFromEntry(entry)
    const payload = {
      data,
      ...internals,
    }
    const columns = Object.keys(payload)
      .map((key) => `"${key}"`)
      .join(', ')
    const values = Object.keys(payload).map((_, index) => `$${index + 1}`)
    const query = `INSERT INTO ${tableName} (${columns}) VALUES(${values}) RETURNING _id`
    const {rows} = await pool.query(query, Object.values(payload))

    return {
      _id: rows[0]._id,
      ...entry,
    }
  }

  static async $__dbDelete(filter: QueryFilter) {
    const [filterQuery, filterParameters] = this.$__postgresBuildSQLWhere(
      filter.root
    )
    const tableName = this.$__postgresGetTableName()
    const query = `DELETE FROM ${tableName} WHERE ${filterQuery}`
    const {rowCount: deleteCount} = await pool.query(query, filterParameters)

    return {deleteCount}
  }

  static async $__dbDeleteOneById(id: string) {
    const filter = QueryFilter.parse({_id: id})

    return this.$__dbDelete(filter)
  }

  static async $__dbFind({
    fieldSet,
    filter,
    pageNumber = 1,
    pageSize,
    sort,
  }: FindParameters) {
    const tableName = this.$__postgresGetTableName()
    const [filterQuery, filterParameters] = this.$__postgresBuildSQLWhere(
      filter && filter.root
    )
    const fields = [
      this.$__postgresGetFieldProjection(fieldSet),
      'count(*) OVER() AS full_count',
    ]
    const queryNodes = [`SELECT ${fields.join(', ')} FROM ${tableName}`]
    const order = this.$__postgresGetOrderByFromSortObject(sort)

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
    const results = rows.map((result) => {
      const {data, full_count, ...internalFields} = result

      return {
        ...internalFields,
        ...data,
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
      results,
    }
  }

  static async $__dbFindManyById({
    fieldSet,
    filter,
    ids,
  }: FindManyByIdParameters) {
    const filterWithIds = QueryFilter.parse({
      _id: {$in: ids},
    }).intersectWith(filter)
    const {results} = await this.$__dbFind({
      fieldSet,
      filter: filterWithIds,
    })

    return results
  }

  static async $__dbFindOneById({fieldSet, filter, id}: FindOneByIdParameters) {
    const filterWithIds = QueryFilter.parse({_id: id}).intersectWith(filter)
    const {results} = await this.$__dbFind({
      fieldSet,
      filter: filterWithIds,
    })

    return results[0] || null
  }

  static async $__dbSetup() {
    const tableName = this.$__postgresGetTableName()
    const columns = this.$__postgresGetTableSchema()
    const columnString = Object.entries(columns)
      .map(([name, description]) => `"${name}" ${description}`)
      .join(', ')
    const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnString});`

    return pool.query(query)
  }

  static async $__dbUpdate(filter: QueryFilter, update: Fields) {
    const tableName = this.$__postgresGetTableName()
    const {data, internals} = this.$__postgresGetColumnsFromEntry(update)
    const processedInternals = this.$__postgresEncodeDecodeEntry(
      internals,
      'encode'
    )
    const [filterQuery, filterParameters] = this.$__postgresBuildSQLWhere(
      filter && filter.root
    )
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
      ...assignmentParameters,
    ])
    const results = rows.map((row) => {
      const {data, ...internals} = row

      return {
        ...internals,
        ...data,
      }
    })

    return {results}
  }

  static async $__dbUpdateOneById(id: string, update: Fields) {
    const filter = QueryFilter.parse({_id: id})
    const {results} = await this.$__dbUpdate(filter, update)

    return results[0] || null
  }

  static $__postgresBuildSQLWhere(
    node: QueryFilterBranch | QueryFilterField | QueryFilterFork
  ): [string?, SQLParameter?] {
    if (!node) {
      return []
    }

    const parameters: SQLParameter = []
    const query = this.$__postgresBuildSQLWhereAndWriteParameters(
      node,
      parameters
    )

    return [query, parameters]
  }

  static $__postgresBuildSQLWhereAndWriteParameters(
    node: QueryFilterBranch | QueryFilterField | QueryFilterFork,
    parameters: SQLParameter
  ): string {
    if (node instanceof QueryFilterFork) {
      const connector = node.operator === 'and' ? 'AND' : 'OR'
      const members = node.branches
        .map((branch) =>
          this.$__postgresBuildSQLWhereAndWriteParameters(branch, parameters)
        )
        .filter(Boolean)
        .join(` ${connector} `)

      return `(${members})`
    }

    if (node instanceof QueryFilterBranch) {
      return Object.entries(node.fields)
        .map(([name, node]) => {
          const operator = this.$__postgresTranslateOperator(node.operator)

          if (!operator) {
            return null
          }

          const value = Array.isArray(node.value) ? node.value : [node.value]
          const variables = value.map((valueNode) => {
            parameters.push(valueNode)

            return `$${parameters.length}`
          })
          const variableExpression =
            variables.length > 1 ? `(${variables.join(', ')})` : variables[0]
          const fieldName = this.$__postgresGetColumnName(name, true)
          const comparison = `${fieldName} ${operator} ${variableExpression}`

          if (node.isNegated || node.operator === 'nin') {
            return `(NOT ${comparison})`
          }

          return comparison
        })
        .join(' AND ')
    }
  }

  static $__postgresEncodeDecodeEntry(
    entry: Fields,
    type: 'encode' | 'decode'
  ): Fields {
    if (!entry) {
      return entry
    }

    return Object.entries(entry).reduce((entry, [name, value]) => {
      if (name === '_createdAt' || name === '_updatedAt') {
        if (
          type === 'encode' &&
          (typeof value === 'number' || typeof value === 'string')
        ) {
          return {
            ...entry,
            [name]: new Date(value),
          }
        }

        if (type === 'decode' && value instanceof Date) {
          return {
            ...entry,
            [name]: value.getTime(),
          }
        }

        return entry
      }

      return {
        ...entry,
        [name]: value,
      }
    }, {})
  }

  static $__postgresGetColumnName(fieldName: string, getJSONAsText = false) {
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

  static $__postgresGetColumnsFromEntry(entry: PostgreSQL) {
    const data: Fields = {}
    const internals: Fields = {}

    Object.entries(entry).forEach(([key, value]) => {
      if (key.startsWith('_')) {
        internals[key] = value
      } else {
        data[key] = value
      }
    })

    return {
      data,
      internals,
    }
  }

  static $__postgresGetFieldProjection(fieldSet: FieldSetType) {
    if (!fieldSet) {
      return ['*']
    }

    const fields = fieldSet.map((fieldName) => {
      const columnName = this.$__postgresGetColumnName(fieldName)

      return columnName === fieldName
        ? `"${columnName}"`
        : `${columnName} AS "${fieldName}"`
    })

    return fields
  }

  static $__postgresGetOrderByFromSortObject(sortObject: SortObject) {
    if (!sortObject) return

    const members = Object.entries(sortObject).map(([fieldName, value]) => {
      const column = this.$__postgresGetColumnName(fieldName, true)
      const direction = value === 1 ? 'ASC' : 'DESC'

      return `${column} ${direction}`
    })

    return members.join(', ')
  }

  static $__postgresGetTableName() {
    if (this.isBaseModel) {
      return this.handle
    }

    return `model_${this.handle}`
  }

  static $__postgresGetTableSchema() {
    const baseColumns = {
      _id: 'uuid PRIMARY KEY DEFAULT uuid_generate_v4 ()',
      _createdAt: 'timestamp',
      _updatedAt: 'timestamp',
      data: 'jsonb',
    }

    return baseColumns
  }

  static $__postgresTranslateOperator(operator: string): string {
    switch (operator) {
      case 'eq':
        return '='

      case 'gt':
        return '>'

      case 'gte':
        return '>='

      case 'in':
      case 'nin':
        return 'IN'

      case 'lt':
        return '<'

      case 'lte':
        return '<='

      case 'ne':
        return '<>'
    }
  }
}
