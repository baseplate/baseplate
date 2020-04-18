const Request = require('./request')
const Response = require('./response')

module.exports = source => ({callback, event, ...props}) => {
  try {
    const request = new Request(event)
    const response = new Response(callback)

    source(request, response, props)
  } catch (error) {
    callback(error)
  }
}
