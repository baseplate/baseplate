module.exports = {
  primitives: {
    boolean: require('./boolean'),
    mixed: require('./mixed'),
    number: require('./number'),
    string: require('./string'),
  },
  system: {
    array: require('./array'),
    reference: require('./reference'),
  },
}
