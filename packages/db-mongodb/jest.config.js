const {defaults: tsjPreset} = require('ts-jest/presets')

module.exports = {
  transform: tsjPreset.transform,
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  testPathIgnorePatterns: ['/lib/', '/node_modules/'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverage: true,
  preset: '@shelf/jest-mongodb',
}
