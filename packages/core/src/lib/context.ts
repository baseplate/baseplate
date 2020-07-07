export default class Context {
  private hash: Map<string, any>

  constructor(initialData?: object) {
    const hash = new Map(initialData && Object.entries(initialData))

    if (!hash.has('base$cache')) {
      hash.set('base$cache', new Map())
    }

    this.hash = hash
  }

  get(key: string) {
    return this.hash.get(key)
  }

  has(key: string) {
    return this.hash.has(key)
  }

  set(key: string, value: any) {
    return this.hash.set(key, value)
  }
}
