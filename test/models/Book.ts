export default {
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
  virtuals: {
    // Virtuals are fields that exist in the request and response bodies but
    // are not persisted to the database. They can be used to compute data on
    // the stop, with the ability to use the contents of other fields.
    // In this example, we add a field to the response that contains the link
    // for the book on goodreads.com, using the value of the `isbn` field.
    goodreadsUrl: {
      get(input: any) {
        return `https://www.goodreads.com/search?q=${input.isbn}&qid=`
      },
    },
  },
}
