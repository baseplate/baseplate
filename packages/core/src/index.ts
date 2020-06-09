export const createDatastore = require('./lib/datastore/factory')
export const modelStore = require('./lib/modelStore/')
export {handler as handlerGraphQL} from './handlers/graphql'
export {handler as handlerRest} from './handlers/rest'
export {HttpRequest} from './lib/http/request'
export {HttpResponse} from './lib/http/response'
