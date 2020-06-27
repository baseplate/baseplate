import {config as dotEnvConfig} from 'dotenv'

dotEnvConfig()

import Server from './lib/server'

const server = new Server()

export default server
