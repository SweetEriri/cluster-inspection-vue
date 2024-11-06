<template>
  <div class="home">
    <div class="header-container">
      <h1>集群健康概览</h1>
      <div class="controls">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="选择日期"
          :clearable="false"
          @change="refreshData"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
        />
        <el-time-select
          v-model="selectedHour"
          :start="'00:00'"
          :step="'01:00'"
          :end="'23:00'"
          placeholder="选择小时"
          :clearable="false"
          @change="refreshData"
        />
        <el-button
          @click="refreshData"
          :loading="isLoading"
          type="primary"
        >
          刷新数据
        </el-button>
      </div>
    </div>
    <div v-if="isLoading">加载中...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else-if="selectedCluster">
      <el-card class="cluster-card">
        <template #header>
          <div class="card-header">
            <h2>{{ clusterNames[selectedCluster] || selectedCluster }}</h2>
            <el-tag :type="getClusterHealthStatus(selectedCluster)" size="large">
              {{ getClusterHealthStatus(selectedCluster) === 'danger' ? '不健康' : '健康' }}
            </el-tag>
          </div>
        </template>
        <div class="card-content">
          <el-row :gutter="20">
            <el-col :span="8">
              <h3>Node <el-tag type="danger" size="small">{{ clusterData(selectedCluster).Node.length }}</el-tag></h3>
              <el-card v-for="node in clusterData(selectedCluster).Node" :key="node.Name" class="node-card" @click="navigateToNodeDetails(node)">
                <h4>{{ node.Name }}</h4>
                <p :class="{'unhealthy-metric': node.CPUUsagePercent > 80}">CPU: {{ formatUsage(node.CPUUsagePercent) }}</p>
                <p :class="{'unhealthy-metric': node.MemoryUsagePercent > 80}">内存: {{ formatUsage(node.MemoryUsagePercent) }}</p>
                <p :class="{'unhealthy-metric': node.DiskUsagePercent > 80}">磁盘: {{ formatUsage(node.DiskUsagePercent) }}</p>
              </el-card>
            </el-col>
            <el-col :span="8">
              <h3>Pod <el-tag type="danger" size="small">{{ getTotalPodCount(selectedCluster) }}</el-tag></h3>
              <el-collapse v-model="activeNamespaces[selectedCluster]">
                <el-collapse-item v-for="(pods, namespace) in getPodsByNamespace(selectedCluster)" :key="namespace" :title="`${namespace} (${pods.length})`">
                  <div class="pod-container">
                    <el-card 
                      v-for="pod in pods" 
                      :key="pod.Name" 
                      class="pod-card" 
                      :body-style="{ padding: '0px' }" 
                      @click="navigateToPodDetails(pod)"
                    >
                      <div class="pod-header" :class="getPodStatusClass(pod.Status)">
                        <span class="pod-status">{{ pod.Status }}</span>
                      </div>
                      <div class="pod-body">
                        <p class="pod-name">{{ pod.Name }}</p>
                        <div v-if="isUnusualCPU(pod)" class="metric-row">
                          <span class="metric-label">CPU:</span>
                          <span :class="getMetricClass(pod.cpuUsagePercentMin, pod.cpuUsagePercentMax)">
                            {{ formatUsageRange(pod.cpuUsagePercentMin, pod.cpuUsagePercentMax) }}
                          </span>
                        </div>
                        <div v-if="isUnusualMemory(pod)" class="metric-row">
                          <span class="metric-label">内存:</span>
                          <span :class="getMetricClass(pod.memoryUsagePercentMin, pod.memoryUsagePercentMax)">
                            {{ formatUsageRange(pod.memoryUsagePercentMin, pod.memoryUsagePercentMax) }}
                          </span>
                        </div>
                        <div v-if="pod.RestartCount > 3" class="metric-row">
                          <span class="metric-label">重启:</span>
                          <span class="unusual-metric">{{ pod.RestartCount }}</span>
                        </div>
                        <div v-if="pod.UnhealthyContainers && pod.UnhealthyContainers.length > 0" class="metric-row">
                          <span class="metric-label">异常容器:</span>
                          <span class="unusual-metric">{{ pod.UnhealthyContainers.join(', ') }}</span>
                        </div>
                      </div>
                    </el-card>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </el-col>
            <el-col :span="8">
              <h3>Event <el-tag type="danger" size="small">{{ clusterData(selectedCluster).Event.length }}</el-tag></h3>
              <el-card v-for="event in clusterData(selectedCluster).Event" :key="event.ID" class="event-card">
                <h4>{{ event.Reason }}</h4>
                <p>{{ event.Message }}</p>
                <p v-if="event.Count !== undefined">次数: {{ event.Count }}</p>
                <p v-if="event.LastTimestamp">最后发生: {{ formatTimestamp(event.LastTimestamp) }}</p>
              </el-card>
            </el-col>
          </el-row>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, inject, watch, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'

export default {
  name: 'Home',
  setup() {
    const { state } = inject('state')
    const router = useRouter()
    const route = useRoute()

    const selectedCluster = computed(() => state.selectedCluster)
    const clusters = computed(() => state.clusters)
    const clusterNames = computed(() => state.clusterNames)
    const isLoading = ref(false)
    const error = ref(null)

    const currentDate = computed(() => {
      const now = new Date();
      return now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    });

    const currentHour = computed(() => {
      const now = new Date();
      return now.getHours().toString().padStart(2, '0') + ':00'
    });

    const selectedDate = ref(currentDate.value)
    const selectedHour = ref(currentHour.value)

    const activeNamespaces = reactive({})

    const refreshData = async (forceRefresh = false) => {
      if (!selectedCluster.value) return
      isLoading.value = true
      error.value = null
      try {
        const startTime = `${selectedDate.value}T${selectedHour.value}:00`
        const endTime = `${selectedDate.value}T${selectedHour.value.split(':')[0]}:59:59`
        
        const [nodesResponse, podsResponse, eventsResponse] = await Promise.all([
          axios.get(`/cluster-inspection/api/nodes?cluster=${selectedCluster.value}&start_time=${startTime}&endtime=${endTime}`),
          axios.get(`/cluster-inspection/api/pods?cluster=${selectedCluster.value}&start_time=${startTime}&endtime=${endTime}`),
          axios.get(`/cluster-inspection/api/events?cluster=${selectedCluster.value}&start_time=${startTime}&endtime=${endTime}`)
        ])
        
        state.nodes[selectedCluster.value] = nodesResponse.data
        state.pods[selectedCluster.value] = podsResponse.data
        state.events[selectedCluster.value] = eventsResponse.data

        ElMessage.success('数据已刷新')
      } catch (err) {
        console.error('刷新数据时出错:', err)
        error.value = '刷新数据失败: ' + err.message
        ElMessage.error(error.value)
      } finally {
        isLoading.value = false
      }
    }

    onMounted(() => {
      refreshData()
    })

    watch(() => state.selectedCluster, (newCluster, oldCluster) => {
      if (newCluster && newCluster !== oldCluster) {
        refreshData(false) 
      }
    })

    const clusterData = computed(() => (cluster) => ({
      Node: (state.nodes[cluster] || []).filter(node => 
        node.CPUUsagePercent > 80 || node.MemoryUsagePercent > 80 || node.DiskUsagePercent > 80
      ),
      Pod: (state.pods[cluster] || []).filter(pod => 
        pod.cpuUsagePercentMax > 80 || 
        pod.memoryUsagePercentMax > 80 || 
        pod.cpuUsagePercentMin === 0 ||
        pod.memoryUsagePercentMin === 0 ||
        pod.RestartCount > 3 ||
        pod.Status !== 'Running'
      ),
      Event: (state.events[cluster] || []).filter(event => event.Type === 'Error').slice(0, 5)
    }))

    const getPodsByNamespace = (cluster) => {
      const clusterPods = clusterData.value(cluster).Pod
      return clusterPods.reduce((acc, pod) => {
        const namespace = pod.Namespace || 'default'
        if (!acc[namespace]) acc[namespace] = []
        acc[namespace].push(pod)
        return acc
      }, {})
    }

    const getTotalPodCount = (cluster) => {
      return clusterData.value(cluster).Pod.length
    }

    const getClusterHealthStatus = (cluster) => {
      const data = clusterData.value(cluster)
      return data.Node.length > 0 || data.Pod.length > 0 || data.Event.length > 0 ? 'danger' : 'success'
    }

    const formatUsage = (value) => `${value.toFixed(2)}%`

    const formatUsageRange = (min, max) => {
      if (min === 0 && max === 0) {
        return '无使用'
      }
      return `${formatUsage(min)} - ${formatUsage(max)}`
    }

    const isUnusualCPU = (pod) => pod.cpuUsagePercentMax > 80 || pod.cpuUsagePercentMin === 0 || pod.cpuUsagePercentMax === 0

    const isUnusualMemory = (pod) => pod.memoryUsagePercentMax > 80 || pod.memoryUsagePercentMin === 0 || pod.memoryUsagePercentMax === 0

    const getMetricClass = (min, max) => {
      if (min === 0 && max === 0) return 'unusual-metric'
      if (max > 80) return 'high-usage-metric'
      if (min === 0) return 'zero-usage-metric'
      return ''
    }

    const getPodStatusType = (status) => {
      const types = { Running: 'success', Pending: 'warning', Failed: 'danger' }
      return types[status] || 'info'
    }

    const formatTimestamp = (timestamp) => {
      return new Date(timestamp).toLocaleString()
    }

    const getPodStatusClass = (status) => {
      const classes = {
        Running: 'status-running',
        Pending: 'status-pending',
        Failed: 'status-failed'
      }
      return classes[status] || 'status-unknown'
    }

    const navigateToNodeDetails = (node) => {
      router.push({
        name: 'NodeDetails',
        params: { name: node.Name },
        query: {
          cluster: selectedCluster.value,
          date: selectedDate.value,
          hour: selectedHour.value.split(':')[0]
        }
      })
    }

    const navigateToPodDetails = (pod) => {
      router.push({
        name: 'PodDetails',
        params: { name: pod.Name },
        query: {
          cluster: selectedCluster.value,
          date: selectedDate.value,
          hour: selectedHour.value.split(':')[0],
        }
      })
    }

    return {
      selectedCluster,
      clusters,
      clusterNames,
      isLoading,
      error,
      selectedDate,
      selectedHour,
      refreshData,
      clusterData,
      getClusterHealthStatus,
      formatUsage,
      formatUsageRange,
      isUnusualCPU,
      isUnusualMemory,
      getMetricClass,
      getPodStatusType,
      formatTimestamp,
      getPodsByNamespace,
      getTotalPodCount,
      activeNamespaces,
      getPodStatusClass,
      navigateToNodeDetails,
      navigateToPodDetails
    }
  }
}
</script>

<style scoped>
.home {
  max-width: 100%;
  margin: 0 auto;
  padding: 20px;
}

.cluster-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.node-card, .pod-card, .event-card {
  margin-bottom: 10px;
}

.card-content {
  margin-top: 20px;
}

.pod-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.pod-card {
  width: 200px;
  margin-bottom: 10px;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
}

.pod-header {
  padding: 8px;
  text-align: center;
  font-weight: bold;
  color: #fff;
}

.status-running { background-color: #67C23A; }
.status-pending { background-color: #E6A23C; }
.status-failed { background-color: #F56C6C; }
.status-unknown { background-color: #909399; }

.pod-body {
  padding: 10px;
}

.pod-name {
  font-size: 0.9em;
  font-weight: bold;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
  margin-bottom: 4px;
}

.metric-label {
  color: #606266;
}

.unusual-metric {
  color: #E6A23C;
  font-weight: bold;
}

.high-usage-metric {
  color: #F56C6C;
  font-weight: bold;
}

.zero-usage-metric {
  color: #409EFF;
  font-weight: bold;
}

.el-collapse-item__header {
  font-size: 1em;
  font-weight: bold;
}

.el-collapse-item__content {
  padding-top: 10px;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.event-card {
  margin-bottom: 10px;
  font-size: 0.9em;
}

.event-card h4 {
  margin-bottom: 5px;
  font-size: 1em;
}

.event-card p {
  margin: 2px 0;
}

.node-card {
  margin-bottom: 10px;
  font-size: 0.9em;
}

.node-card h4 {
  margin-bottom: 5px;
  font-size: 1em;
}

.node-card p {
  margin: 2px 0;
}

.unhealthy-metric {
  color: #f56c6c;
  font-weight: bold;
  font-size: 0.8em;
  margin: 2px 0;
}

:deep(.el-date-editor.el-input),
:deep(.el-date-editor.el-input__wrapper) {
  width: 130px;
}

:deep(.el-select) {
  width: 200px;
}

.el-button {
  margin-left: 10px;
}

.node-card, .pod-card {
  cursor: pointer;
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.node-card:hover, .pod-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
</style>