export default interface JsonApiError {
  detail?: string
  source?: {pointer: string}
  status?: number
  title?: string
}
