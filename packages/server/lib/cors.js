const MAX_AGE = 60 * 60 * 24

module.exports = (req, res, next) => {
  const origin = req.headers.origin
  const headers = req.headers['access-control-request-headers']
  const method = req.headers['access-control-request-method']

  if (origin !== undefined) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Max-Age', MAX_AGE.toString())
  }

  if (headers) {
    res.setHeader('Access-Control-Allow-Headers', headers)
  }

  if (method) {
    res.setHeader('Access-Control-Allow-Methods', method)
  }

  if (req.method === 'options') {
    return res.status(204).end()
  }

  return next(req, res)
}
