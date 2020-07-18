import {createLogger, format, Logger, transports} from 'winston'

const defaultMeta = {service: 'baseplate'}
const mainLogger = createLogger({
  level: process.env.BASEPLATE_LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.errors({stack: true}),
    format.splat(),
    format.json()
  ),
  defaultMeta,
})

if (process.env.NODE_ENV !== 'production') {
  mainLogger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple(),
        format.splat()
      ),
      silent: process.env.NODE_ENV === 'test',
    })
  )
}

class Base$Logger {
  winstonLogger: Logger
  __id: number

  constructor(winstonLogger: Logger) {
    this.__id = Math.random()
    this.winstonLogger = winstonLogger
  }

  debug(...args: any[]) {
    return this.winstonLogger.log.apply(this.winstonLogger, ['debug', ...args])
  }

  error(...args: any[]) {
    return this.winstonLogger.log.apply(this.winstonLogger, ['error', ...args])
  }

  info(...args: any[]) {
    return this.winstonLogger.log.apply(this.winstonLogger, ['info', ...args])
  }

  warn(...args: any[]) {
    return this.winstonLogger.log.apply(this.winstonLogger, ['warn', ...args])
  }
}

const instance = new Base$Logger(mainLogger)

export default instance

export function create(name: string) {
  const meta = {...defaultMeta, service: `${defaultMeta.service}/${name}`}

  return new Base$Logger(mainLogger.child(meta))
}
