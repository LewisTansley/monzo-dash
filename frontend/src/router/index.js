import { createRouter, createWebHistory } from 'vue-router'
import { useVaultStore } from '../stores/vault.js'
import { useAppletTransitionStore } from '../stores/appletTransition.js'

const routes = [
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

const router = createRouter({
  history: createWebHistory(),
  routes
})

function isCrossViewNavigation(to, from) {
  if (!from.name) return false
  return to.name !== from.name || to.path !== from.path
}

router.beforeEach(async (to, from) => {
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
    return { name: 'Settings', query: { redirect: to.fullPath } }
  }
  return true
})

router.afterEach((to, from) => {
  if (isCrossViewNavigation(to, from)) {
    useAppletTransitionStore().scheduleRailsRestore()
  }
})

export default router
