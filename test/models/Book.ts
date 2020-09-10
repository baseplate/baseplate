import {BaseModel} from '../../packages/core/src'

export default (ModelClass: typeof BaseModel) => ({
  // This property is required when defining models using the object syntax.
  name: 'book',
  fields: {
    title: {
      type: String,
      required: true,
    },
    isbn: {
      type: Number,
      unique: true,
    },

    // This field establishes a relationship with the "Author" model. In this
    // case, it's a 1:N relationship, meaning that a book can reference a
    // single author.
    author: 'Author',

    // This represents a N:N relationship (note the array syntax). This means
    // that a book can have many genres.
    genre: ['Genre'],
  },
})
