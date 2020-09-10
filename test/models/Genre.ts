import {BaseModel} from '../../packages/core/src'

export default (ModelClass: typeof BaseModel) => ({
  name: 'genre',
  fields: {
    name: {
      type: String,
      required: true,
    },

    // A model can reference itself.
    parentGenre: 'genre',
  },
})
