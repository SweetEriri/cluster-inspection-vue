<template>
  <div class="pod-details">
    <h1>Pod Details</h1>
    <div v-if="loading">加载中...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else-if="pod">
      <el-card class="pod-card">
        <div class="card-header">
          <span class="pod-name">{{ pod.Name }}</span>
          <div class="tags">
            <el-tag :type="getStatusTagType(pod.Status)" class="status-tag">{{ pod.Status }}</el-tag>
            <el-tag :type="isHealthy(pod) ? 'success' : 'danger'" class="health-tag">
              {{ isHealthy(pod) ? 'Healthy' : 'Unhealthy' }}
            </el-tag>
          </div>
        </div>
        <div class="card-body">
          <p><strong>Namespace:</strong> {{ pod.Namespace }}</p>
          <p><strong>Category:</strong> {{ pod.Category }}</p>
          <p><strong>Owner Name:</strong> {{ pod.OwnerName }}</p>
          <p><strong>CPU Usage Percent:</strong> {{ formatUsage(pod.cpuUsagePercent) }}</p>
          <p><strong>Memory Usage Percent:</strong> {{ formatUsage(pod.memoryUsagePercent) }}</p>
          <p :class="{'unhealthy-field': isCPUUsageMaxUnhealthy(pod)}"><strong>CPU Usage Percent (Max):</strong> {{ formatUsage(pod.cpuUsagePercentMax) }}</p>
          <p :class="{'unhealthy-field': isCPUUsageMinUnhealthy(pod)}"><strong>CPU Usage Percent (Min):</strong> {{ formatUsage(pod.cpuUsagePercentMin) }}</p>
          <p :class="{'unhealthy-field': isCPUUsageAvgUnhealthy(pod)}"><strong>CPU Usage Percent (Avg):</strong> {{ formatUsage(pod.cpuUsagePercentAvg) }}</p>
          <p :class="{'unhealthy-field': isMemoryUsageMaxUnhealthy(pod)}"><strong>Memory Usage Percent (Max):</strong> {{ formatUsage(pod.memoryUsagePercentMax) }}</p>
          <p :class="{'unhealthy-field': isMemoryUsageMinUnhealthy(pod)}"><strong>Memory Usage Percent (Min):</strong> {{ formatUsage(pod.memoryUsagePercentMin) }}</p>
          <p :class="{'unhealthy-field': isMemoryUsageAvgUnhealthy(pod)}"><strong>Memory Usage Percent (Avg):</strong> {{ formatUsage(pod.memoryUsagePercentAvg) }}</p> 
          <p :class="{'unhealthy-field': isRestartCountUnhealthy(pod)}"><strong>Restart Count:</strong> {{ pod.RestartCount }}</p>
          <p><strong>CPU Usage (Max):</strong> {{ pod.CPUUsageMax }}</p>
          <p><strong>CPU Usage (Min):</strong> {{ pod.CPUUsageMin }}</p>
          <p><strong>CPU Usage (Avg):</strong> {{ pod.CPUUsageAvg }}</p>
          <p><strong>Memory Usage (Max):</strong> {{ pod.MemoryUsageMax }}</p>
          <p><strong>Memory Usage (Min):</strong> {{ pod.MemoryUsageMin }}</p>
          <p><strong>Memory Usage (Avg):</strong> {{ pod.MemoryUsageAvg }}</p>
          <p><strong>CPU Request:</strong> {{ pod.CPURequest }}</p>
          <p><strong>CPU Limit:</strong> {{ pod.CPULimit }}</p>
          <p><strong>Memory Request:</strong> {{ pod.MemoryRequest }}</p>
          <p><strong>Memory Limit:</strong> {{ pod.MemoryLimit }}</p>
          <p><strong>Cluster:</strong> {{ cluster }}</p>
        </div>
        <h2>Container Statuses</h2>
        <div class="container-statuses">
          <el-card v-for="container in parsedContainerStatuses" :key="container.Name" class="container-card">
            <div class="card-header">
              <span class="container-name">{{ container.Name }}</span>
              <div class="tags">
                <el-tag :type="getStatusTagType(container.State)" class="status-tag">{{ container.State }}</el-tag>
                <el-tag :type="isContainerHealthy(container) ? 'success' : 'danger'" class="health-tag">
                  {{ isContainerHealthy(container) ? 'Healthy' : 'Unhealthy' }}
                </el-tag>
              </div>
            </div>
            <div class="card-body">
              <p><strong>CPU Usage (Max):</strong> {{ container.CPUUsageMax }}</p>
              <p><strong>CPU Usage (Min):</strong> {{ container.CPUUsageMin }}</p>
              <p><strong>CPU Usage (Avg):</strong> {{ container.CPUUsageAvg }}</p>
              <p><strong>Memory Usage (Max):</strong> {{ container.MemoryUsageMax }}</p>
              <p><strong>Memory Usage (Min):</strong> {{ container.MemoryUsageMin }}</p>
              <p><strong>Memory Usage (Avg):</strong> {{ container.MemoryUsageAvg }}</p>
              <p><strong>CPU Request:</strong> {{ container.CPURequest }}</p>
              <p><strong>CPU Limit:</strong> {{ container.CPULimit }}</p>
              <p><strong>Memory Request:</strong> {{ container.MemoryRequest }}</p>
              <p><strong>Memory Limit:</strong> {{ container.MemoryLimit }}</p>
              <p :class="{'unhealthy-field': isContainerCPUUsageMaxUnhealthy(container)}"><strong>CPU Usage Percent (Max):</strong> {{ formatUsage(container.CPUUsagePercentMax) }}</p>
              <p :class="{'unhealthy-field': isContainerCPUUsageMinUnhealthy(container)}"><strong>CPU Usage Percent (Min):</strong> {{ formatUsage(container.CPUUsagePercentMin) }}</p>
              <p :class="{'unhealthy-field': isContainerCPUUsageAvgUnhealthy(container)}"><strong>CPU Usage Percent (Avg):</strong> {{ formatUsage(container.CPUUsagePercentAvg) }}</p>
              <p :class="{'unhealthy-field': isContainerMemoryUsageMaxUnhealthy(container)}"><strong>Memory Usage Percent (Max):</strong> {{ formatUsage(container.MemoryUsagePercentMax) }}</p>
              <p :class="{'unhealthy-field': isContainerMemoryUsageMinUnhealthy(container)}"><strong>Memory Usage Percent (Min):</strong> {{ formatUsage(container.MemoryUsagePercentMin) }}</p>
              <p :class="{'unhealthy-field': isContainerMemoryUsageAvgUnhealthy(container)}"><strong>Memory Usage Percent (Avg):</strong> {{ formatUsage(container.MemoryUsagePercentAvg) }}</p>
            </div>
          </el-card>
        </div>
      </el-card>
    </div>
    <div v-else>未找到 Pod 信息</div>
    <el-button @click="goBack">Back</el-button>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElCard, ElTag, ElButton, ElMessage } from 'element-plus'
import axios from 'axios'

export default {
  components: {
    ElCard,
    ElTag,
    ElButton
  },
  setup() {
    const route = useRoute();
    const router = useRouter();

    const pod = ref(null);
    const loading = ref(true);
    const error = ref(null);
    const cluster = ref(route.query.cluster);
    const selectedDate = ref(route.query.date || new Date().toISOString().split('T')[0])
    const selectedHour = ref(route.query.hour || new Date().getHours().toString().padStart(2, '0'))

    const fetchPodDetails = async (forceRefresh = false) => {
      loading.value = true;
      error.value = null;
      try {
        const { name, namespace } = route.params;
        const clusterValue = route.query.cluster;

        if (!clusterValue || !selectedDate.value || !selectedHour.value) {
          throw new Error('Missing required query parameters');
        }

        const startTime = `${selectedDate.value}T${selectedHour.value}:00:00`
        const endTime = `${selectedDate.value}T${selectedHour.value}:59:59`

        const response = await axios.get(`/cluster-inspection/api/pods`, {
          params: {
            cluster: clusterValue,
            start_time: startTime,
            end_time: endTime,
            force_refresh: forceRefresh,
            pod_name: name,
            namespace: namespace
          }
        });

        if (response.data && response.data.length > 0) {
          pod.value = response.data[0];
          cluster.value = clusterValue;
        } else {
          throw new Error('Pod not found in fetched data');
        }

        console.log('Fetched pod details:', pod.value);
      } catch (err) {
        console.error('Error fetching pod details:', err);
        error.value = err.message || 'Failed to fetch pod details';
        ElMessage.error(error.value);
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      fetchPodDetails();
    });

    const goBack = () => {
      router.push({ 
        name: 'pods',  
      });
    };

    const getStatusTagType = (status) => {
      switch (status) {
        case 'Running':
          return 'success'
        case 'Pending':
          return 'warning'
        case 'Failed':
          return 'danger'
        default:
          return 'info'
      }
    }

    const isCPUUsageMaxUnhealthy = (pod) => {
      return pod.CPULimit !== 'No Limit' && pod.cpuUsagePercentMax > 80
    }

    const isMemoryUsageMaxUnhealthy = (pod) => {
      return pod.MemoryLimit !== 'No Limit' && pod.memoryUsagePercentMax > 80
    }

    const isCPUUsageMinUnhealthy = (pod) => {
      return pod.CPULimit !== 'No Limit' && pod.cpuUsagePercentMin === 0
    }

    const isMemoryUsageMinUnhealthy = (pod) => {
      return pod.MemoryLimit !== 'No Limit' && pod.memoryUsagePercentMin === 0
    }

    const isCPUUsageAvgUnhealthy = (pod) => {
      return pod.CPULimit !== 'No Limit' && pod.cpuUsagePercentAvg === 0
    }

    const isMemoryUsageAvgUnhealthy = (pod) => {
      return pod.MemoryLimit !== 'No Limit' && pod.MemoryUsagePercentAvg === 0 
    }

    const isRestartCountUnhealthy = (pod) => {
      return pod.RestartCount > 3
    }

    const isContainerCPUUsageMaxUnhealthy = (container) => {
      return container.CPULimit !== 'No Limit' && container.CPUUsagePercentMax > 80
    }

    const isContainerMemoryUsageMaxUnhealthy = (container) => {
      return container.MemoryLimit !== 'No Limit' && container.MemoryUsagePercentMax > 80
    }

    const isContainerCPUUsageMinUnhealthy = (container) => {
      return container.CPULimit !== 'No Limit' && container.CPUUsagePercentMin === 0
    }

    const isContainerMemoryUsageMinUnhealthy = (container) => {
      return container.MemoryLimit !== 'No Limit' && container.MemoryUsagePercentMin === 0
    }

    const isContainerCPUUsageAvgUnhealthy = (container) => {
      return container.CPULimit !== 'No Limit' && container.CPUUsagePercentAvg > 80
    }

    const isContainerMemoryUsageAvgUnhealthy = (container) => {
      return container.MemoryLimit !== 'No Limit' && container.MemoryUsagePercentAvg > 80
    }

    const isHealthy = (pod) => {
      return !(
        isCPUUsageMaxUnhealthy(pod) ||
        isMemoryUsageMaxUnhealthy(pod) ||
        isCPUUsageMinUnhealthy(pod) ||
        isMemoryUsageMinUnhealthy(pod) ||
        isCPUUsageAvgUnhealthy(pod) ||
        isMemoryUsageAvgUnhealthy(pod) ||
        isRestartCountUnhealthy(pod) ||
        isContainerCPUUsageMaxUnhealthy(pod) ||
        isContainerMemoryUsageMaxUnhealthy(pod) ||
        isContainerCPUUsageMinUnhealthy(pod) ||
        isContainerMemoryUsageMinUnhealthy(pod) ||
        isContainerCPUUsageAvgUnhealthy(pod) ||
        isContainerMemoryUsageAvgUnhealthy(pod)
      )
    }

    const isContainerHealthy = (container) => {
      return container.State === 'Running' && container.CPUUsagePercentMax < 80 && container.MemoryUsagePercentMax < 80 && container.CPUUsagePercentAvg < 80 && container.MemoryUsagePercentAvg < 80
    }

    const parsedContainerStatuses = computed(() => {
      if (!pod.value || !pod.value.ContainerStatuses) return []
      try {
        return JSON.parse(pod.value.ContainerStatuses)
      } catch (error) {
        console.error('Error parsing ContainerStatuses:', error)
        return []
      }
    })

    const formatUsage = (value) => {
      // 首先尝试将值转换为数字
      const numValue = Number(value);
      
      // 检查是否为有效数字且不小于0
      if (!isNaN(numValue) && numValue >= 0) {
        return numValue.toFixed(2) + '%';
      }
      
      // 如果无法转换为有效数字或小于0，返回 'N/A'
      return 'N/A';
    };

    return {
      pod,
      loading,
      error,
      cluster,
      goBack,
      getStatusTagType,
      isHealthy,
      isContainerHealthy,
      isCPUUsageMaxUnhealthy,
      isMemoryUsageMaxUnhealthy,
      isCPUUsageMinUnhealthy,
      isMemoryUsageMinUnhealthy,
      isCPUUsageAvgUnhealthy,
      isMemoryUsageAvgUnhealthy,
      isRestartCountUnhealthy,
      isContainerCPUUsageMaxUnhealthy,
      isContainerMemoryUsageMaxUnhealthy,
      isContainerCPUUsageMinUnhealthy,
      isContainerMemoryUsageMinUnhealthy,
      isContainerCPUUsageAvgUnhealthy,
      isContainerMemoryUsageAvgUnhealthy,
      parsedContainerStatuses,
      formatUsage,
      fetchPodDetails
    }
  }
}
</script>

<style scoped>
.pod-details {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  text-align: left;
}

.pod-card {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.tags {
  display: flex;
  gap: 10px;
}

.pod-name, .container-name {
  font-weight: bold;
}

.status-tag {
  margin-left: 10px;
}

.health-tag {
  margin-left: 10px;
}

.card-body {
  text-align: left;
}

.card-body p {
  margin: 5px 0;
  font-size: 14px;
}

.unhealthy-field {
  color: #d32f2f;
}

.container-statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-top: 20px;
}

.container-card {
  flex: 1 1 calc(50% - 20px); /* 两个卡片一排 */
  border: 1px solid #ebeef5;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.container-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

.unhealthy {
  background-color: #ffebee;
  color: #d32f2f;
}

.el-button {
  margin-top: 20px;
  margin-right: 10px;
}
</style>
