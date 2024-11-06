<template>
  <div class="workload-recommendations">
    <h1>工作负载资源推荐</h1>
    <p v-if="error" style="color: red;">{{ error }}</p>
    <div v-if="loading">加载中...</div>
    <div v-else-if="workloads.length > 0">
      <el-input
        v-model="searchQuery"
        placeholder="搜索工作负载或命名空间"
        prefix-icon="el-icon-search"
        style="margin-bottom: 20px;"
      />
      <el-collapse v-model="activeNamespaces">
        <el-collapse-item 
          v-for="(workload, index) in filteredWorkloads"
          :key="workload?.DeploymentName || index"
          :name="workload?.DeploymentName || index" 
        >
          <template #title>
            <div class="workload-title" :class="{ 'needs-adjustment': needsAdjustment(workload) }">
              <span class="namespace">{{ workload.Namespace }}</span>
              <span class="separator">/</span>
              <span class="deployment-name">{{ workload.DeploymentName }}</span>
              <el-tag v-if="needsAdjustment(workload)" size="small" type="warning" class="adjustment-tag">需要调整</el-tag>
            </div>
          </template>
          <el-card class="workload-card">
            <template #header>
              <div class="card-header">
                <span>{{ workload.DeploymentName }}</span>
                <el-tag>{{ getWorkloadType(workload) }}</el-tag>
                <el-tag>周期内（7天）统计的副本数: {{ workload.Replicas }}</el-tag>
              </div>
            </template>
            <div class="resource-recommendations">
              <div class="resource-item">
                <h3>CPU 建议</h3>
                <p>请求: {{ workload.CPURequestAdjustment }}</p>
                <p>限制: {{ workload.CPULimitAdjustment }}</p>
              </div>
              <div class="resource-item">
                <h3>内存建议</h3>
                <p>请求: {{ workload.MemoryRequestAdjustment }}</p>
                <p>限制: {{ workload.MemoryLimitAdjustment }}</p>
              </div>
            </div>
            <div class="usage-charts">
              <resource-usage-chart
                title="CPU 调整建议"
                resourceType="cpu"
                :current-usage="workload.AverageCPUUsage"
                :max-usage="workload.MaxCPUUsage"
                :request-usage="workload.CPURequest"
                :limit-usage="workload.CPULimit"
                :suggested-request-usage="getSuggestedCPURequest(workload)"
                :suggested-limit-usage="getSuggestedCPULimit(workload)"
                unit="cores"
              />
              <resource-usage-chart
                title="内存调整建议"
                resourceType="memory"
                :current-usage="workload.AverageMemoryUsage"
                :max-usage="workload.MaxMemoryUsage"
                :request-usage="workload.MemoryRequest"
                :limit-usage="workload.MemoryLimit"
                :suggested-request-usage="getSuggestedMemoryRequest(workload)"
                :suggested-limit-usage="getSuggestedMemoryLimit(workload)"
                unit="Mi"
                suggestedUnit="Mi"
              />
            </div>
            <div v-for="pods in Object.values(workload.LatestPodsByCategory)" :key="pods[0]?.Name" class="pods-container">
              <h4>最新的三个Pod指标</h4>
              <div class="pod-list">
                <pod-icon
                  v-for="pod in pods"
                  :key="pod.Name"
                  :pod="pod"
                />
              </div>
            </div>
          </el-card>
        </el-collapse-item>
      </el-collapse>
    </div>
    <p v-else>暂无数据</p>
  </div>
</template>

<script>
import { ref, computed, watch, inject, onErrorCaptured } from 'vue'
import { ElCollapse, ElCollapseItem, ElCard, ElTag, ElInput } from 'element-plus'
import axios from 'axios'
import ResourceUsageChart from './ResourceUsageChart.vue'
import PodIcon from './PodIcon.vue'
import { ElMessage } from 'element-plus'

export default {
  components: {
    ElCollapse,
    ElCollapseItem,
    ElCard,
    ElTag,
    ElInput,
    ResourceUsageChart,
    PodIcon
  },
  setup() {
    const { state } = inject('state')
    const error = ref(null)
    const workloads = ref([])
    const activeNamespaces = ref([])
    const searchQuery = ref('')
    const loading = ref(false)
  
    const selectedCluster = computed(() => state.selectedCluster)

    const getApiUrl = (clusterName) => {
      return `/cluster-inspection/api/deployment-resource-recommendations?cluster=${clusterName}`
    }
  
    const fetchWorkloads = async () => {
      loading.value = true
      error.value = null
      try {
        const response = await axios.get(getApiUrl(selectedCluster.value))
        // console.log('Raw API response:', response.data)
        workloads.value = response.data.recommendations || []
        // console.log('Processed workloads:', workloads.value)
        ElMessage.success(`已成功加载 ${selectedCluster.value} 集群的工作负载资源推荐`)
      } catch (err) {
        console.error('获取工作负载推荐数据失败:', err)
        error.value = '加载数据时出错: ' + err.message
        workloads.value = []
        ElMessage.error(`加载 ${selectedCluster.value} 集群工作负载资源推荐失败`)
      } finally {
        loading.value = false
      }
    }
  
    // 监听集群变化并重新获取数据
    watch(selectedCluster, () => {
      fetchWorkloads()
    })

    // 初始加载数据
    fetchWorkloads()
  
    const filteredWorkloads = computed(() => {
      // console.log('Filtering workloads, current count:', workloads.value.length)
      if (!Array.isArray(workloads.value)) {
        // console.error('workloads is not an array:', workloads.value)
        return []
      }
      return workloads.value.filter(workload => {
        if (!workload) return false
        const deploymentName = workload.DeploymentName || ''
        const namespace = workload.Namespace || ''
        const query = searchQuery.value.toLowerCase()
        return deploymentName.toLowerCase().includes(query) ||
               namespace.toLowerCase().includes(query)
      })
    })
  
    const getWorkloadType = (workload) => {
      if (!workload || !workload.LatestPodsByCategory) return 'Unknown'
      return Object.keys(workload.LatestPodsByCategory)[0] || 'Unknown'
    }
  
    const getSuggestedCPUUsage = (workload) => {
      if (!workload || !workload.CPURequestAdjustment) return 0
      const match = workload.CPURequestAdjustment.match(/(\d+)m/)
      return match ? parseInt(match[1]) / 1000 : 0
    }
  
    const getSuggestedMemoryUsage = (workload) => {
      if (!workload || !workload.MemoryRequestAdjustment) return 0
      const match = workload.MemoryRequestAdjustment.match(/(\d+)Mi/)
      return match ? parseInt(match[1]) : 0
    }
  
    const getWorkloadTitle = (workload) => {
      if (!workload) return 'Unknown'
      return `${workload.Namespace || 'Unknown'} / ${workload.DeploymentName || 'Unknown'}`
    }
  
    const getSuggestedCPURequest = (workload) => {
      if (!workload || !workload.CPURequestAdjustment) {
        // console.warn('Invalid CPU request adjustment:', workload?.CPURequestAdjustment);
        return null; // 返回 null 而不是 0
      }
      const match = workload.CPURequestAdjustment.match(/(\d+(?:\.\d+)?)([m]?)/)
      if (!match) {
        // console.warn('Unable to parse CPU request adjustment:', workload.CPURequestAdjustment);
        return null;
      }
      const value = parseFloat(match[1])
      return match[2] === 'm' ? value / 1000 : value
    }

    const getSuggestedCPULimit = (workload) => {
      if (!workload || !workload.CPULimitAdjustment) {
        // console.warn('Invalid CPU limit adjustment:', workload?.CPULimitAdjustment);
        return null;
      }
      const match = workload.CPULimitAdjustment.match(/(\d+(?:\.\d+)?)([m]?)/)
      if (!match) {
        // console.warn('Unable to parse CPU limit adjustment:', workload.CPULimitAdjustment);
        return null;
      }
      const value = parseFloat(match[1])
      return match[2] === 'm' ? value / 1000 : value
    }

    const getSuggestedMemoryRequest = (workload) => {
      if (!workload || !workload.MemoryRequestAdjustment) {
        // console.warn('Invalid memory request adjustment:', workload?.MemoryRequestAdjustment);
        return null;
      }
      const match = workload.MemoryRequestAdjustment.match(/(\d+(?:\.\d+)?)([KMGTPEi]i?)/)
      if (!match) {
        // console.warn('Unable to parse memory request adjustment:', workload.MemoryRequestAdjustment);
        return null;
      }
      const value = parseFloat(match[1])
      const unit = match[2]
      // 转换为 Mi
      switch(unit) {
        case 'Ki': return value / 1024
        case 'Gi': return value * 1024
        case 'Ti': return value * 1024 * 1024
        case 'Mi': return value
        default:
          // console.warn('Unexpected memory unit:', unit);
          return value // 假设默认单位是 Mi
      }
    }

    const getSuggestedMemoryLimit = (workload) => {
      if (!workload || !workload.MemoryLimitAdjustment) {
        // console.warn('Invalid memory limit adjustment:', workload?.MemoryLimitAdjustment);
        return null;
      }
      const match = workload.MemoryLimitAdjustment.match(/(\d+(?:\.\d+)?)([KMGTPEi]i?)/)
      if (!match) {
        // console.warn('Unable to parse memory limit adjustment:', workload.MemoryLimitAdjustment);
        return null;
      }
      const value = parseFloat(match[1])
      const unit = match[2]
      // 转换为 Mi
      switch(unit) {
        case 'Ki': return value / 1024
        case 'Gi': return value * 1024
        case 'Ti': return value * 1024 * 1024
        case 'Mi': return value
        default:
          // console.warn('Unexpected memory unit:', unit);
          return value // 假设默认单位是 Mi
      }
    }
  
    onErrorCaptured((err, instance, info) => {
      // console.error('Captured in DeploymentRecommendations:', err, instance, info)
      error.value = `渲染错误: ${err.message}`
      return false // 阻止错误继续传播
    })
  
    // 添加这个函数来判断工作负载是否需要调整
    const needsAdjustment = (workload) => {
      return workload.CPURequestAdjustment !== '无需调整' || 
             workload.MemoryRequestAdjustment !== '无需调整' ||
             workload.CPULimitAdjustment !== '无需调整' ||
             workload.MemoryLimitAdjustment !== '无需调整';
    };
    
    return {
      error,
      workloads,
      activeNamespaces,
      searchQuery,
      filteredWorkloads,
      getWorkloadType,
      getSuggestedCPUUsage,
      getSuggestedMemoryUsage,
      getWorkloadTitle,
      getSuggestedCPURequest,
      getSuggestedCPULimit,
      getSuggestedMemoryRequest,
      getSuggestedMemoryLimit,
      needsAdjustment,
      fetchWorkloads,
      selectedCluster,
      loading
    }
  }
}
</script>

<style scoped>
.workload-recommendations {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.workload-card {
  width: 100%;
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.resource-recommendations {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.resource-item {
  width: 48%;
}

.usage-charts {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}

.pods-container {
  margin-top: 20px;
}

.pod-list {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 30px;
}

.workload-title {
  display: flex;
  align-items: center;
  font-size: 16px;
}

.workload-title.needs-adjustment {
  color: #E6A23C;
}

.namespace {
  font-weight: bold;
  color: #409EFF;
}

.separator {
  margin: 0 8px;
  color: #909399;
}

.deployment-name {
  font-weight: bold;
}

.adjustment-tag {
  margin-left: 10px;
}
</style>
