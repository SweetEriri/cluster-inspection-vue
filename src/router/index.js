import { createRouter, createWebHistory } from 'vue-router'
import Home from '../components/Home.vue'
import NodeList from '../components/NodeList.vue'
import PodList from '../components/PodList.vue'
import EventList from '../components/EventList.vue'
import AggregateReport from '../components/AggregateReport.vue'
import DeploymentRecommendations from '@/components/DeploymentRecommendations.vue'


const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/nodes',
    name: 'NodeList',
    component: NodeList
  },
  {
    path: '/pods',
    name: 'pods',
    component: PodList
  },
  {
    path: '/events',
    name: 'events',
    component: EventList
  },
  {
    path: '/report',
    name: 'report',
    component: AggregateReport
  },
  {
    path: '/pod-details/:name',
    name: 'PodDetails',
    component: () => import('../components/PodDetails.vue')
  },
  {
    path: '/node-details/:name',
    name: 'NodeDetails',
    component: () => import('../components/NodeDetails.vue')
  },
  {
    path: '/recommendations',
    name: 'DeploymentRecommendations',
    component: DeploymentRecommendations
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
