declare namespace NodeJS {
  export interface Global {
    __MONGO_DB_NAME__: string
    __MONGO_URI__: string
  }
}

declare module 'short-hash' {
  export default function createHash(input: string): string
}
