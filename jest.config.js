const {defaults: tsjPreset} = require('ts-jest/presets')

module.exports = {
  transform: tsjPreset.transform,
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(js?|ts?)$',
  testPathIgnorePatterns: ['/lib/', '/node_modules/'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverage: true,
  collectCoverageFrom: ['**/src/**'],
  preset: '@shelf/jest-mongodb',
}
