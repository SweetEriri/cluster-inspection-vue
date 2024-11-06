<template>
  <div class="aggregate-report">
    <div class="header-container">
      <h1>Aggregate Report</h1>
      <div class="controls">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          :clearable="false"
          :editable="false"
          @change="onDateTimeChange"
        />
        <el-select 
          v-model="selectedHour" 
          placeholder="选择小时"
          @change="onDateTimeChange"
        >
          <el-option
            v-for="hour in 24"
            :key="hour - 1"
            :label="(hour - 1).toString().padStart(2, '0') + ':00'"
            :value="(hour - 1).toString().padStart(2, '0')"
          />
        </el-select>
        <el-button
          @click="confirmRefresh"
          :loading="isLoading"
          type="danger"
          class="force-refresh-btn"
        >
          强制刷新
        </el-button>
      </div>
    </div>
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else>
      <el-tabs type="border-card">
        <el-tab-pane label="Unhealthy Nodes">
          <el-input
            v-model="nodeSearchQuery"
            placeholder="搜索节点"
            prefix-icon="el-icon-search"
            style="margin-bottom: 15px;"
          />
          <el-table :data="filteredUnhealthyNodes" style="width: 100%">
            <el-table-column prop="Name" label="Node Name"></el-table-column>
            <el-table-column prop="CPUUsagePercent" label="CPU Usage">
              <template #default="scope">
                <span :class="{ 'high-usage': scope.row.CPUUsagePercent > 80 }">
                  {{ formatPercentage(scope.row.CPUUsagePercent) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="MemoryUsagePercent" label="Memory Usage">
              <template #default="scope">
                <span :class="{ 'high-usage': scope.row.MemoryUsagePercent > 80 }">
                  {{ formatPercentage(scope.row.MemoryUsagePercent) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="DiskUsagePercent" label="Disk Usage">
              <template #default="scope">
                <span :class="{ 'high-usage': scope.row.DiskUsagePercent > 80 }">
                  {{ formatPercentage(scope.row.DiskUsagePercent) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="Actions" width="120">
              <template #default="scope">
                <el-button @click="navigateToNodeDetails(scope.row)" type="primary" size="small">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        
        <el-tab-pane label="Unhealthy Pods">
          <el-input
            v-model="podSearchQuery"
            placeholder="搜索 Pod 或命名空间"
            prefix-icon="el-icon-search"
            style="margin-bottom: 15px;"
          />
          <div v-for="(pods, category) in filteredCategorizedUnhealthyPods" :key="category">
            <h3>{{ category }}</h3>
            <el-table :data="pods" style="width: 100%">
              <el-table-column prop="Name" label="Pod Name"></el-table-column>
              <el-table-column prop="Namespace" label="Namespace"></el-table-column>
              <el-table-column prop="Status" label="Status">
                <template #default="scope">
                  <el-tag :type="getPodStatusType(scope.row.Status)">{{ scope.row.Status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="cpuUsagePercentMax" label="CPU Usage (Max/Min)">
                <template #default="scope">
                  <div>
                    <span :class="{ 'high-usage': scope.row.cpuUsagePercentMax > 80 }">
                      Max: {{ formatPercentage(scope.row.cpuUsagePercentMax) }}
                    </span>
                  </div>
                  <div>
                    <span :class="{ 'zero-usage': scope.row.cpuUsagePercentMin === 0 }">
                      Min: {{ formatPercentage(scope.row.cpuUsagePercentMin) }}
                    </span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="memoryUsagePercentMax" label="Memory Usage (Max/Min)">
                <template #default="scope">
                  <div>
                    <span :class="{ 'high-usage': scope.row.memoryUsagePercentMax > 80 }">
                      Max: {{ formatPercentage(scope.row.memoryUsagePercentMax) }}
                    </span>
                  </div>
                  <div>
                    <span :class="{ 'zero-usage': scope.row.memoryUsagePercentMin === 0 }">
                      Min: {{ formatPercentage(scope.row.memoryUsagePercentMin) }}
                    </span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="RestartCount" label="Restart Count">
                <template #default="scope">
                  <span :class="{ 'high-usage': scope.row.RestartCount > 3 }">
                    {{ scope.row.RestartCount }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="Actions" width="120">
                <template #default="scope">
                  <el-button @click="navigateToPodDetails(scope.row)" type="primary" size="small">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="Error Events">
          <el-table :data="errorEvents" style="width: 100%">
            <el-table-column prop="Type" label="Type">
              <template #default="scope">
                <el-tag :type="getEventTypeTagType(scope.row.Type)">{{ scope.row.Type }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="Reason" label="Reason"></el-table-column>
            <el-table-column prop="Message" label="Message"></el-table-column>
            <el-table-column prop="Time" label="Time"></el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, inject, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import axios from 'axios'

export default {
  setup() {
    const router = useRouter()
    const { state } = inject('state')
    
    const isLoading = ref(false)
    const error = ref(null)

    const currentDate = computed(() => {
      const now = new Date();
      return now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    });

    const currentHour = computed(() => {
      const now = new Date();
      return now.getHours().toString().padStart(2, '0');
    });

    const selectedDate = ref(currentDate.value)
    const selectedHour = ref(currentHour.value)
    
    const nodeSearchQuery = ref('')
    const podSearchQuery = ref('')

    const unhealthyNodes = computed(() => {
      return (state.nodes[state.selectedCluster] || []).filter(node => 
        node.CPUUsagePercent > 80 || 
        node.MemoryUsagePercent > 80 || 
        node.DiskUsagePercent > 80 ||
        node.CPUUsagePercent === 0 ||
        node.MemoryUsagePercent === 0 ||
        node.DiskUsagePercent === 0
      )
    })

    const categorizedUnhealthyPods = computed(() => {
      const pods = (state.pods[state.selectedCluster] || []).filter(pod => 
        pod.Status !== 'Running' || 
        pod.cpuUsagePercentMax > 80 || 
        pod.memoryUsagePercentMax > 80 || 
        pod.RestartCount > 3 ||
        pod.cpuUsagePercentMin === 0 ||
        pod.memoryUsagePercentMin === 0
      )

      return {
        '状态非Running': pods.filter(pod => pod.Status !== 'Running'),
        '高CPU使用率': pods.filter(pod => pod.cpuUsagePercentMax > 80),
        '高内存使用率': pods.filter(pod => pod.memoryUsagePercentMax > 80),
        '重启次数过多': pods.filter(pod => pod.RestartCount > 3),
        'CPU使用率为0': pods.filter(pod => pod.cpuUsagePercentMin === 0),
        '内存使用率为0': pods.filter(pod => pod.memoryUsagePercentMin === 0)
      }
    })

    const errorEvents = computed(() => {
      return (state.events[state.selectedCluster] || []).filter(event => event.Type === 'Error')
    })

    const formatPercentage = (value) => {
      return value != null ? `${value.toFixed(2)}%` : 'N/A'
    }

    const getPodStatusType = (status) => {
      switch (status) {
        case 'Running': return 'success'
        case 'Pending': return 'warning'
        case 'Failed': return 'danger'
        default: return 'info'
      }
    }

    const getEventTypeTagType = (type) => {
      switch (type) {
        case 'Normal': return 'success'
        case 'Warning': return 'warning'
        default: return 'info'
      }
    }
    
    const refreshData = async (forceRefresh = false) => {
      if (!state.selectedCluster) return
      isLoading.value = true
      error.value = null
      try {
        const startTime = `${selectedDate.value}T${selectedHour.value.split(':')[0]}:00:00`
        const endTime = `${selectedDate.value}T${selectedHour.value.split(':')[0]}:59:59`
        
        const apiPrefix = forceRefresh ? '/api/report' : '/api';
        const [nodesResponse, podsResponse, eventsResponse] = await Promise.all([
          axios.get(`/cluster-inspection${apiPrefix}/nodes?cluster=${state.selectedCluster}&start_time=${startTime}&end_time=${endTime}`),
          axios.get(`/cluster-inspection${apiPrefix}/pods?cluster=${state.selectedCluster}&start_time=${startTime}&end_time=${endTime}`),
          axios.get(`/cluster-inspection${apiPrefix}/events?cluster=${state.selectedCluster}&start_time=${startTime}&end_time=${endTime}`)
        ])
        
        state.nodes[state.selectedCluster] = nodesResponse.data
        state.pods[state.selectedCluster] = podsResponse.data
        state.events[state.selectedCluster] = eventsResponse.data

        ElMessage.success(forceRefresh ? '数据已强制刷新' : '数据已刷新')
      } catch (err) {
        console.error('刷新数据时出错:', err)
        error.value = '刷新数据失败: ' + err.message
        ElMessage.error(error.value)
      } finally {
        isLoading.value = false
      }
    }

    const onDateTimeChange = () => {
      refreshData(false)
    }

    const confirmRefresh = () => {
      ElMessageBox.confirm(
        '强制刷新将重新获取所有数据，可能需要一些时间。是否继续？',
        '确认强制刷新',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
        .then(async() => {
          await refreshData(true)
        })
        .catch(() => {
          console.log('强制刷新已取消')
        })
    }

    const navigateToNodeDetails = (node) => {
      router.push({
        name: 'NodeDetails',
        params: { name: node.Name },
        query: {
          cluster: state.selectedCluster,
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
          cluster: state.selectedCluster,
          date: selectedDate.value,
          hour: selectedHour.value.split(':')[0],
          namespace: pod.Namespace
        }
      })
    }

    const filteredUnhealthyNodes = computed(() => {
      return unhealthyNodes.value.filter(node =>
        node.Name.toLowerCase().includes(nodeSearchQuery.value.toLowerCase())
      )
    })

    const filteredCategorizedUnhealthyPods = computed(() => {
      const result = {}
      for (const [category, pods] of Object.entries(categorizedUnhealthyPods.value)) {
        result[category] = pods.filter(pod =>
          pod.Name.toLowerCase().includes(podSearchQuery.value.toLowerCase()) ||
          pod.Namespace.toLowerCase().includes(podSearchQuery.value.toLowerCase())
        )
      }
      return result
    })

    onMounted(() => {
      refreshData()
    })

    watch(() => state.selectedCluster, (newCluster, oldCluster) => {
      if (newCluster !== oldCluster) {
        refreshData()
      }
    })

    return {
      state,
      isLoading,
      error,
      selectedDate,
      selectedHour,
      onDateTimeChange,
      confirmRefresh,
      navigateToNodeDetails,
      navigateToPodDetails,
      nodeSearchQuery,
      podSearchQuery,
      filteredUnhealthyNodes,
      filteredCategorizedUnhealthyPods,
      unhealthyNodes,
      categorizedUnhealthyPods,
      errorEvents,
      formatPercentage,
      getPodStatusType,
      getEventTypeTagType,
    }
  }
}
</script>

<style scoped>
.aggregate-report {
  max-width: 100%;
  margin: 0 auto;
  padding: 20px;
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

.force-refresh-btn {
  background-color: #f56c6c;
  border-color: #f56c6c;
}

.force-refresh-btn:hover {
  background-color: #f78989;
  border-color: #f78989;
}

.high-usage {
  color: #f56c6c;
  font-weight: bold;
}

.zero-usage {
  color: #e6a23c;
  font-weight: bold;
}

.el-tabs {
  margin-top: 20px;
}

.el-table {
  margin-top: 10px;
}

.el-date-picker,
.el-select {
  width: 140px;
}

h3 {
  margin-top: 20px;
  margin-bottom: 10px;
  color: #409EFF;
}

.el-button--small {
  padding: 8px 15px;
  font-size: 12px;
}
</style>
