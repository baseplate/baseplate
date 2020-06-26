import GraphQLSchema from './schema'
import ModelStore from '../../modelStore/base'

class GraphQLModelStore extends ModelStore {
  constructor() {
    super(GraphQLSchema)
  }
}

const instance = new GraphQLModelStore()

export {GraphQLModelStore}
export default instance
