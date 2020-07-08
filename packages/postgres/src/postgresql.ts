import {Pool} from 'pg'

import {
  BaseModel,
  Context,
  createLogger,
  DataConnector,
  FieldSet,
  QueryFilter,
  QueryFilterBranch,
  QueryFilterField,
  QueryFilterFork,
  SortObject,
} from '@baseplate/core'

const logger = createLogger('postgres')
const pool = new Pool()

type Fields = Record<string, any>
type SQLParameter = Array<any>

export default class PostgreSQL extends DataConnector.DataConnector {
  private buildSQLWhere(
    node: QueryFilterBranch | QueryFilterField | QueryFilterFork
  ): [string?, SQLParameter?] {
    if (!node) {
      return []
    }

    const parameters: SQLParameter = []
    const query = this.buildSQLWhereAndWriteParameters(node, parameters)

    return [query, parameters]
  }

  private buildSQLWhereAndWriteParameters(
    node: QueryFilterBranch | QueryFilterField | QueryFilterFork,
    parameters: SQLParameter
  ): string {
    if (node instanceof QueryFilterFork) {
      const connector = node.operator === 'and' ? 'AND' : 'OR'
      const members = node.branches
        .map((branch) =>
          this.buildSQLWhereAndWriteParameters(branch, parameters)
        )
        .filter(Boolean)
        .join(` ${connector} `)

      return `(${members})`
    }

    if (node instanceof QueryFilterBranch) {
      return Object.entries(node.fields)
        .map(([name, node]) => {
          const operator = this.translateOperator(node.operator)

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
          const fieldName = this.getColumnName(name, true)
          const comparison = `${fieldName} ${operator} ${variableExpression}`

          if (node.isNegated || node.operator === 'nin') {
            return `(NOT ${comparison})`
          }

          return comparison
        })
        .join(' AND ')
    }
  }

  private encodeDecodeEntry(entry: Fields, type: 'encode' | 'decode'): Fields {
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

  private getColumnName(fieldName: string, getJSONAsText = false) {
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

  private getColumnsFromEntry(entry: DataConnector.Result) {
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

  private getFieldProjection(fieldSet: FieldSet) {
    if (!fieldSet) {
      return ['*']
    }

    const fields = fieldSet.toArray().map((fieldName) => {
      const columnName = this.getColumnName(fieldName)

      return columnName === fieldName
        ? `"${columnName}"`
        : `${columnName} AS "${fieldName}"`
    })

    return fields
  }

  private getOrderByFromSortObject(sortObject: SortObject) {
    if (!sortObject) return

    const members = Object.entries(sortObject).map(([fieldName, value]) => {
      const column = this.getColumnName(fieldName, true)
      const direction = value === 1 ? 'ASC' : 'DESC'

      return `${column} ${direction}`
    })

    return members.join(', ')
  }

  private getTableName(Model: typeof BaseModel) {
    if (Model.base$isInternal()) {
      return Model.base$handle.replace('$', '_')
    }

    return `model_${Model.base$handle}`
  }

  private getTableSchema() {
    const baseColumns = {
      _id: 'uuid PRIMARY KEY DEFAULT uuid_generate_v4 ()',
      _createdAt: 'timestamp',
      _updatedAt: 'timestamp',
      data: 'jsonb',
    }

    return baseColumns
  }

  private translateOperator(operator: string): string {
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

  async createOne(
    entry: DataConnector.Result,
    Model: typeof BaseModel
  ): Promise<DataConnector.Result> {
    const tableName = this.getTableName(Model)
    const {data, internals} = this.getColumnsFromEntry(entry)
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

  async delete(filter: QueryFilter, Model: typeof BaseModel) {
    const [filterQuery, filterParameters] = this.buildSQLWhere(filter.root)
    const tableName = this.getTableName(Model)
    const query = `DELETE FROM ${tableName} WHERE ${filterQuery}`
    const {rowCount: deleteCount} = await pool.query(query, filterParameters)

    return {deleteCount}
  }

  async deleteOneById(id: string, Model: typeof BaseModel) {
    const filter = QueryFilter.parse({_id: id})

    return this.delete(filter, Model)
  }

  async find(
    {
      fieldSet,
      filter,
      pageNumber = 1,
      pageSize,
      sort,
    }: DataConnector.FindParameters,
    Model: typeof BaseModel
  ) {
    const tableName = this.getTableName(Model)
    const [filterQuery, filterParameters] = this.buildSQLWhere(
      filter && filter.root
    )
    const fields = [
      this.getFieldProjection(fieldSet),
      'count(*) OVER() AS full_count',
    ]
    const queryNodes = [`SELECT ${fields.join(', ')} FROM ${tableName}`]
    const order = this.getOrderByFromSortObject(sort)

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

  async findManyById(
    {fieldSet, filter, ids}: DataConnector.FindManyByIdParameters,
    Model: typeof BaseModel,
    context: Context
  ) {
    logger.debug('findManyById: %s', ids, {
      model: Model.base$handle,
    })

    const filterWithIds = QueryFilter.parse({
      _id: {$in: ids},
    }).intersectWith(filter)
    const {results} = await this.find(
      {
        fieldSet,
        filter: filterWithIds,
      },
      Model
    )

    return results
  }

  async findOneById(
    {batch, fieldSet, filter, id}: DataConnector.FindOneByIdParameters,
    Model: typeof BaseModel,
    context: Context
  ) {
    if (batch) {
      return PostgreSQL.base$batchFindOneById(
        {fieldSet, filter, id},
        context,
        (ids: string[]) =>
          this.findManyById({fieldSet, filter, ids}, Model, context)
      )
    }

    logger.debug('findOneById: %s', id, {model: Model.base$handle})

    const filterWithIds = QueryFilter.parse({_id: id}).intersectWith(filter)
    const {results} = await this.find(
      {
        fieldSet,
        filter: filterWithIds,
      },
      Model
    )

    return results[0] || null
  }

  async setup(Model: typeof BaseModel) {
    const tableName = this.getTableName(Model)
    const columns = this.getTableSchema()
    const columnString = Object.entries(columns)
      .map(([name, description]) => `"${name}" ${description}`)
      .join(', ')
    const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnString});`

    return pool.query(query)
  }

  async update(filter: QueryFilter, update: Fields, Model: typeof BaseModel) {
    const tableName = this.getTableName(Model)
    const {data, internals} = this.getColumnsFromEntry(update)
    const processedInternals = this.encodeDecodeEntry(internals, 'encode')
    const [filterQuery, filterParameters] = this.buildSQLWhere(
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

  async updateOneById(id: string, update: Fields, Model: typeof BaseModel) {
    const filter = QueryFilter.parse({_id: id})
    const {results} = await this.update(filter, update, Model)

    return results[0] || null
  }
}
