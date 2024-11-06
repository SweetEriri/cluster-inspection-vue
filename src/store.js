import { ref, reactive } from 'vue'
import axios from 'axios'
import router from './router'
import { cacheService } from './services/cacheService'

// 集群名称映射,需要与后端保持一致
const clusterNameMap = {
  '': '',
  '': '',
}

const CACHE_KEYS = {
  CLUSTERS: 'clusters',
  NODES: 'nodes',
  PODS: 'pods',
  EVENTS: 'events',
}

const state = reactive({
  nodes: ref([]),
  pods: ref([]),  
  events: ref([]),  
  loading: false,
  error: null,
  clusters: [],
  clusterNames: {},
  selectedCluster: localStorage.getItem('selectedCluster') || null,
  pageSize: 0
})

export function provideState() {
  const fetchClusters = async () => {
    try {
      const response = await axios.get('/cluster-inspection/api/clusters')
      state.clusters = response.data.clusters
      state.clusterNames = state.clusters.reduce((acc, cluster) => {
        acc[cluster] = clusterNameMap[cluster] || cluster;
        return acc;
      }, {});
      if (state.clusters.length > 0 && !state.selectedCluster) {
        setSelectedCluster(state.clusters[0])
      }
    } catch (error) {
      console.error('Error fetching clusters:', error)
      state.error = 'Failed to fetch clusters'
    }
  }

  const setSelectedCluster = (cluster) => {
    state.selectedCluster = cluster
    localStorage.setItem('selectedCluster', cluster)
    fetchData(router.currentRoute.value.name)
  }

  function formatTimeString(timeString) {
    if (typeof timeString !== 'string') {
      console.warn('Invalid time string:', timeString);
      return ''; // 返回空字符串，而不是原始值
    }
    // 移除末尾的 ":00" 如果存在
    return timeString.replace(/:00$/, '');
  }

  const fetchResource = async (resourceType, startTime, endTime) => {
    if (!state.selectedCluster) return

    state.loading = true
    state.error = null

    try {
      let url = `/cluster-inspection/api/${resourceType}`
      let params = {
        cluster: state.selectedCluster,
        start_time: formatTimeString(startTime),
        end_time: formatTimeString(endTime)
      }

      console.log(`Fetching ${resourceType} with params:`, params);

      const response = await axios.get(url, { params })
      
      let processedData
      if (Array.isArray(response.data)) {
        processedData = response.data
      } else if (response.data && typeof response.data === 'object') {
        processedData = Object.values(response.data)
      } else {
        throw new Error(`Invalid ${resourceType} data received`)
      }

      state[resourceType].value = processedData
      return processedData
    } catch (error) {
      console.error(`Error fetching ${resourceType}:`, error)
      state.error = `Failed to fetch ${resourceType} data: ` + error.message
      state[resourceType].value = []
      throw error
    } finally {
      state.loading = false
    }
  }

  const fetchNodes = (startTime, endTime) => {
    return fetchResource('nodes', startTime, endTime);
  }

  const fetchPods = (startTime, endTime) => {
    return fetchResource('pods', startTime, endTime);
  }

  const fetchEvents = (startTime, endTime) => {
    return fetchResource('events', startTime, endTime);
  }

  const fetchData = async (routeName = null, customStartTime = null, customEndTime = null) => {
    if (!state.selectedCluster) {
      console.warn('No cluster selected, skipping data fetch')
      return
    }
    state.loading = true
    state.error = null
    try {
      const currentRoute = routeName || router.currentRoute.value.name
      const fetchPromises = []
      
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const hour = now.getHours().toString().padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const startTime = customStartTime || `${dateString}T${hour}:00:00:00`;
      const endTime = customEndTime || `${dateString}T${hour}:59:59`;

      console.log('fetchData time range:', { startTime, endTime });

      switch (currentRoute) {
        case 'nodes':
        case 'NodeDetails':
          fetchPromises.push(fetchNodes(startTime, endTime))
          break
        case 'pods':
        case 'podDetails':
          fetchPromises.push(fetchPods(startTime, endTime))
          break
        case 'events':
          fetchPromises.push(fetchEvents(startTime, endTime))
          break
        case 'Home':
        case 'report':
        default:
          fetchPromises.push(
            fetchNodes(startTime, endTime),
            fetchPods(startTime, endTime),
            fetchEvents(startTime, endTime)
          )
      }
      await Promise.all(fetchPromises)
      return {
        nodes: state.nodes.value,
        pods: state.pods.value,
        events: state.events.value
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      state.error = 'Failed to fetch data'
      return { nodes: [], pods: [], events: [] }
    } finally {
      state.loading = false
    }
  }

  const initialize = async () => {
    if (state.clusters.length === 0) {
      await fetchClusters()
    }
    if (state.selectedCluster && router.currentRoute.value.name) {
      await fetchData()
    }
  }

  const clearCache = () => {
    cacheService.clearCache()
  }

  return {
    state,
    fetchData,
    fetchNodes,
    fetchPods,
    fetchEvents,
    fetchClusters,
    setSelectedCluster,
    initialize,
    clearCache
  }
}

export const useStore = () => {
  return provideState()
}
