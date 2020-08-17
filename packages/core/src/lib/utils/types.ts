// Unwraps the type of a Promise
export type Await<T> = T extends Promise<infer U> ? U : T
