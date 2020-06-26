function isPlainObject(input: any): boolean {
  return (
    input &&
    (Object.getPrototypeOf(input) === null ||
      input.toString() === '[object Object]')
  )
}

export default isPlainObject
