export default class Context extends Map<string, any> {
  constructor(initialData?: object) {
    super(initialData && Object.entries(initialData))
  }
}
