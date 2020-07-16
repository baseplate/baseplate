import {modelStore} from '@baseplate/core'

import PostgreSQL from './postgresql'

const dataConnector = new PostgreSQL()

modelStore.setDataConnector(dataConnector)

export * from '@baseplate/core'
