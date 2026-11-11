import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('@/features/validator/ValidatorPage.vue') },
  { path: '/:pathMatch(.*)*', component: () => import('./NotFoundPage.vue') },
]
