const Request = require('./request')
const Response = require('./response')

module.exports = source => ({callback, context, event}) => {
  try {
    const request = new Request(event)
    const response = new Response(callback)

    source(request, response, context)
  } catch (error) {
    callback(error)
  }
}
