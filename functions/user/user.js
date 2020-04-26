const {UnauthorizedError} = require('../../lib/errors')
const JsonApiResponse = require('../../lib/specs/jsonApi/response')

module.exports.get = async (req, res) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError()
    }

    const user = await req.user.sync()
    const {body, statusCode} = await JsonApiResponse.toObject({
      entries: user,
      url: req.url
    })

    res.status(statusCode).json(body)
  } catch (errors) {
    const {body, statusCode} = await JsonApiResponse.toObject({
      errors,
      url: req.url
    })

    res.status(statusCode).json(body)
  }
}
