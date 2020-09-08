import type {App} from './dataConnectors'
import {Request, Response} from './requestResponse'

interface CreateUserParameters {
  accessLevel?: 'admin' | 'user'
  app: App
  username: string
  password: string
  permissions?: Record<string, any>
}

export async function createUser({
  accessLevel = 'admin',
  app,
  username,
  password,
  permissions,
}: CreateUserParameters) {
  const UserModel = app.modelStore.get('base$user')
  const user = await UserModel.create(
    {
      accessLevel,
      username,
      password,
    },
    {authenticate: false}
  )

  if (permissions) {
    const AccessModel = app.modelStore.get('base$access')
    const ops = Object.keys(permissions).map((modelName) => {
      return AccessModel.create(
        {
          ...permissions[modelName],
          user,
          model: modelName,
        },
        {authenticate: false}
      )
    })

    // ----> remove
    const f = await Promise.all(ops)

    console.log(require('util').inspect(f, {depth: Infinity}))
  }

  return user
}

export async function getAccessToken({
  app,
  username,
  password,
  modelName = 'base$users',
}: {
  app: App
  username: string
  password: string
  modelName?: string
}) {
  const req = new Request({
    body: {
      grant_type: 'password',
      username,
      password,
    },
    method: 'post',
    url: `/${modelName}/token`,
  })
  const res = new Response()

  app.routesRest.initialize()

  const {$body} = await app.routesRest.handler(req, res)

  return $body.access_token
}
