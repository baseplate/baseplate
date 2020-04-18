module.exports.get = (req, res) => {
  res.status(200).json({hello: req.params.foo})
}

module.exports.route = '/hello-world/:foo'
