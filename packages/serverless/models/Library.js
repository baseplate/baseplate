module.exports = {
  fields: {
    name: {
      type: String,
      required: true,
      validate: input => !input.startsWith('X'),
      errorMessage: 'Must not start with an X'
    },
    city: String,
    books: ['Book'],
    owner: 'Author',
    owner2: 'Author'
  },
  virtuals: {
    whatever: {
      async get() {
        return {
          hello: 'there'
        }
      }
    }
  }
}
