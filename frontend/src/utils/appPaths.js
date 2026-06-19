/**
 * Mobile layout: m. subdomain OR /m/ path prefix.
 * Path prefix is only used when not on m. subdomain.
 */

export function detectMobileLayout(location = window.location) {
  return (
    location.hostname.startsWith('m.') ||
    location.pathname === '/m' ||
    location.pathname.startsWith('/m/')
  )
}

export function usesMobilePathPrefix(location = window.location) {
  if (location.hostname.startsWith('m.')) return false
  return location.pathname === '/m' || location.pathname.startsWith('/m/')
}

export function isInMobilePathContext(location = window.location) {
  return usesMobilePathPrefix(location)
}

export function resolveRouteName(name, options = {}) {
  const loc = options.location || (typeof window !== 'undefined' ? window.location : { pathname: '/', hostname: '' })
  const mobile = options.mobileLayout ?? detectMobileLayout(loc)
  const usePrefix = options.usePathPrefix ?? usesMobilePathPrefix(loc)

  if (!name) return name
  if (!mobile || !usePrefix) return name
  if (String(name).startsWith('Mobile')) return name
  return `Mobile${name}`
}

export function resolveAppRoute(location, options = {}) {
  const loc = options.location || (typeof window !== 'undefined' ? window.location : { pathname: '/', hostname: '' })
  const mobile = options.mobileLayout ?? detectMobileLayout(loc)
  const usePrefix = options.usePathPrefix ?? usesMobilePathPrefix(loc)

  if (!location || typeof location !== 'object') {
    return location
  }

  const resolved = { ...location }

  if (resolved.name) {
    resolved.name = resolveRouteName(resolved.name, { location: loc, mobileLayout: mobile, usePathPrefix: usePrefix })
  }

  if (resolved.path) {
    const stripped = stripMobilePathPrefix(resolved.path)
    resolved.path = resolveAppPath(stripped, { location: loc, mobileLayout: mobile, usePathPrefix: usePrefix })
  }

  return resolved
}

export function resolveAppPath(path, options = {}) {
  const loc = options.location || window.location
  const mobile = options.mobileLayout ?? detectMobileLayout(loc)
  const usePrefix = options.usePathPrefix ?? usesMobilePathPrefix(loc)

  const normalized = !path || path === '/' ? '/' : path.startsWith('/') ? path : `/${path}`

  if (!mobile || !usePrefix) {
    return normalized
  }

  if (normalized === '/') return '/m'
  return `/m${normalized}`
}

export function stripMobilePathPrefix(path) {
  if (path === '/m') return '/'
  if (path.startsWith('/m/')) return path.slice(2) || '/'
  return path
}

export function swapMobileHost(url) {
  try {
    const parsed = new URL(url, window.location.origin)
    if (parsed.hostname.startsWith('m.')) {
      parsed.hostname = parsed.hostname.slice(2)
    } else {
      parsed.hostname = `m.${parsed.hostname}`
    }
    return parsed.toString()
  } catch {
    return url
  }
}
