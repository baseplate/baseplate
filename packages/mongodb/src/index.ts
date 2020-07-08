import {modelStore} from '@baseplate/core'

import MongoDB from './mongodb'

const dataConnector = new MongoDB()

modelStore.setDataConnector(dataConnector)

export * from '@baseplate/core'
