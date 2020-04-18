module.exports = input =>
  input &&
  (Object.getPrototypeOf(input) === null ||
    input.toString() === '[object Object]')
