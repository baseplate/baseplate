const Request = require('./request')
const Response = require('./response')

module.exports = source => ({callback, context, event, requestProps = {}}) => {
  try {
    const request = new Request(event, requestProps)
    const response = new Response(callback)

    source(request, response, {context})
  } catch (error) {
    callback(error)
  }
}
