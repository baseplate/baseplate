import jwt from 'jsonwebtoken'

import TokenData from './tokenData'

const TOKEN_PRIVATE_KEY = 'PRIVATE_KEY'

type JWTPayload = {
  data: TokenData
}

const parseAuthorizationHeader = (authorizationHeader: string) => {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    return
  }

  const match = authorizationHeader.match(/^Bearer (.*)$/)

  if (!match) {
    return
  }

  const accessToken = match[1]

  try {
    const payload = jwt.verify(accessToken, TOKEN_PRIVATE_KEY)

    return (<JWTPayload>payload).data
  } catch {
    return
  }
}

export default parseAuthorizationHeader
