module.exports = {
  fields: {
    _createdAt: Number,
    _updatedAt: Number,
    firstName: {
      type: String,
      required: true,
      minLength: 2,
      maxLength: 15
    },
    lastName: String,
    address: {
      street: String,
      door: Number
    }
  }
}
