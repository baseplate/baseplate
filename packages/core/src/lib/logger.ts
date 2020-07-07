import {createLogger, format, transports} from 'winston'

const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.errors({stack: true}),
    format.splat(),
    format.json()
  ),
  defaultMeta: {service: 'Baseplate'},
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple(),
        format.splat()
      ),
    })
  )
}

function debug(...args: any[]) {
  return logger.log.apply(logger, ['debug', ...args])
}

function error(...args: any[]) {
  return logger.log.apply(logger, ['error', ...args])
}

function info(...args: any[]) {
  return logger.log.apply(logger, ['info', ...args])
}

function warn(...args: any[]) {
  return logger.log.apply(logger, ['warn', ...args])
}

export {debug, error, info, warn}
