module.exports = {
  fields: {
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
