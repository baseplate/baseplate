export default function normalizeRoute(route: string): string {
  return route.startsWith('/') ? route : `/${route}`
}
