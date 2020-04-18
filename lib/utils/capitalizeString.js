module.exports = input => {
  if (!input) return input

  return input.substr(0, 1).toUpperCase() + input.substr(1)
}
