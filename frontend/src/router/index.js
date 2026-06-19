import { createRouter, createWebHistory } from 'vue-router'
import { useVaultStore } from '../stores/vault.js'
import { useAppletTransitionStore } from '../stores/appletTransition.js'
import { useLayoutStore } from '../stores/layout.js'
import { resolveAppPath, resolveAppRoute, usesMobilePathPrefix } from '../utils/appPaths.js'

const appRoutes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresVault: true }
  },
  {
    path: '/transactions',
    name: 'Transactions',
    component: () => import('../views/TransactionsKanbanView.vue'),
    meta: { requiresVault: true }
  },
  {
    path: '/automations',
    name: 'Automations',
    component: () => import('../views/AutomationsView.vue'),
    meta: { requiresVault: true }
  },
  {
    path: '/automations/groups/new',
    name: 'AutomationGroupNew',
    component: () => import('../views/AutomationGroupEditorView.vue'),
    meta: { requiresVault: true }
  },
  {
    path: '/automations/groups/:id',
    name: 'AutomationGroupEditor',
    component: () => import('../views/AutomationGroupEditorView.vue'),
    meta: { requiresVault: true }
  },
  {
    path: '/automations/new',
    redirect: { name: 'Automations', query: { edit: 'new' } }
  },
  {
    path: '/automations/:id',
    redirect: (to) => ({ name: 'Automations', query: { edit: to.params.id } })
  },
  {
    path: '/budget',
    name: 'AffordabilityChecker',
    component: () => import('../views/BudgetView.vue'),
    meta: { requiresVault: true }
  },
  {
    path: '/home-budget',
    redirect: { name: 'AffordabilityChecker' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue')
  }
]

function mobilePath(route) {
  if (route.path === '/') return ''
  return route.path.replace(/^\//, '')
}

function mobileRedirect(redirect) {
  if (typeof redirect === 'string') {
    return redirect === '/' ? '/m' : `/m${redirect}`
  }
  if (typeof redirect === 'object' && redirect !== null) {
    if (redirect.name) {
      return { ...redirect, name: `Mobile${redirect.name}` }
    }
    if (redirect.path) {
      return { ...redirect, path: mobileRedirect(redirect.path) }
    }
  }
  if (typeof redirect === 'function') {
    return (to) => {
      const result = redirect(to)
      if (typeof result === 'string') return mobileRedirect(result)
      if (result?.name) return { ...result, name: `Mobile${result.name}` }
      if (result?.path) return { ...result, path: mobileRedirect(result.path) }
      return result
    }
  }
  return redirect
}

const mobileChildRoutes = appRoutes.map((route) => {
  const mobileRoute = {
    ...route,
    path: mobilePath(route),
    meta: { ...route.meta, mobileLayout: true }
  }
  if (route.name) {
    mobileRoute.name = `Mobile${route.name}`
  }
  if (route.redirect) {
    mobileRoute.redirect = mobileRedirect(route.redirect)
  }
  return mobileRoute
})

const routes = [
  ...appRoutes,
  {
    path: '/m',
    meta: { mobileLayout: true },
    children: mobileChildRoutes
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

function isCrossViewNavigation(to, from) {
  if (!from.name) return false
  const toBase = String(to.name || '').replace(/^Mobile/, '')
  const fromBase = String(from.name || '').replace(/^Mobile/, '')
  return toBase !== fromBase || to.path !== from.path
}

function isMobileRoute(to) {
  return Boolean(to.meta.mobileLayout) || to.path === '/m' || to.path.startsWith('/m/')
}

router.beforeEach(async (to, from) => {
  if (to.path === '/m') {
    return '/m/'
  }

  const inMobilePathContext =
    (typeof window !== 'undefined' && usesMobilePathPrefix(window.location)) || isMobileRoute(from)

  if (inMobilePathContext && !isMobileRoute(to)) {
    return resolveAppRoute(to, { mobileLayout: true, usePathPrefix: true })
  }

  useLayoutStore().syncFromLocation(
    typeof window !== 'undefined' ? window.location : { pathname: to.path, hostname: '' }
  )

  if (isCrossViewNavigation(to, from)) {
    useAppletTransitionStore().beginRouteChange()
  }

  const vault = useVaultStore()
  if (!vault.exists && vault.unlocked === false) {
    try {
      await vault.refreshStatus()
    } catch {
      // API may be down; settings still reachable
    }
  }

  if (to.meta.requiresVault && !vault.unlocked) {
    const settingsPath = isMobileRoute(to)
      ? resolveAppPath('/settings', { location: window.location })
      : '/settings'
    return { path: settingsPath, query: { redirect: to.fullPath } }
  }
  return true
})

router.afterEach((to, from) => {
  useLayoutStore().syncFromLocation()
  if (isCrossViewNavigation(to, from)) {
    useAppletTransitionStore().scheduleRailsRestore()
  }
})

export default router
