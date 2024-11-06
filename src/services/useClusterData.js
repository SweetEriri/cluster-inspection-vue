import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

export function useClusterData(state, fetchNodes, fetchPods, fetchEvents) {
  const isLoading = ref(false)
  const error = ref(null)
  const selectedDate = ref(new Date().toISOString().split('T')[0])
  const selectedHour = ref(new Date().getHours().toString().padStart(2, '0') + ':00')

  const getTimeRange = computed(() => {
    const [year, month, day] = selectedDate.value.split('-')
    const hour = selectedHour.value.split(':')[0]
    const startTime = new Date(year, month - 1, day, hour, 0, 0)
    const endTime = new Date(year, month - 1, day, hour, 59, 59)
    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    }
  })

  const refreshAllData = async (forceRefresh = false) => {
    if (isLoading.value) return
    isLoading.value = true
    error.value = null
    try {
      const { startTime, endTime } = getTimeRange.value
      const apiPrefix = forceRefresh ? '/api/report' : '/api';
      const fetchPromises = [
        fetchNodes(state.selectedCluster, startTime, endTime, apiPrefix),
        fetchPods(state.selectedCluster, startTime, endTime, apiPrefix),
        fetchEvents(state.selectedCluster, startTime, endTime, apiPrefix)
      ]

      await Promise.all(fetchPromises)

      ElMessage.success(forceRefresh ? '所有数据已强制刷新' : '所有数据已刷新')
    } catch (err) {
      console.error('刷新数据时出错:', err)
      error.value = '刷新数据失败: ' + err.message
      ElMessage.error(error.value)
    } finally {
      isLoading.value = false
    }
  }

  const handleForceRefresh = () => {
    refreshAllData(true)
  }

  const onDateTimeChange = () => {
    refreshAllData(false)
  }

  return {
    isLoading,
    error,
    selectedDate,
    selectedHour,
    refreshAllData,
    handleForceRefresh,
    onDateTimeChange
  }
}
