module.exports = {
  fields: {
    _createdAt: Number,
    _updatedAt: Number,
    title: {
      type: String,
      required: true
    },
    isbn: String,
    author: 'Author'
  }
}
