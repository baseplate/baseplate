import {config as dotEnvConfig} from 'dotenv'

dotEnvConfig()

import * as Core from '@baseplate/core'
import Server from './lib/server'

export default function createServer(app: typeof Core) {
  return new Server(app)
}
