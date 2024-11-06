<template>
  <div class="node-details">
    <h1>节点详细信息</h1>
    <div v-if="loading">加载中...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else-if="node">
      <div class="detail-item">
        <strong>节点名称:</strong> {{ node.Name }}
      </div>
      <div class="detail-item">
        <strong>CPU容量:</strong> {{ node.CPUCapacity }}
      </div>
      <div class="detail-item">
        <strong>CPU使用量:</strong> {{ node.CPUUsage }}
      </div>
      <div class="detail-item">
        <strong>CPU使用率:</strong>
        <span :class="{ 'high-usage': node.CPUUsagePercent > 80 }">
          {{ node.CPUUsagePercent.toFixed(2) }}%
        </span>
      </div>
      <div class="detail-item">
        <strong>Memory容量:</strong> {{ node.MemoryCapacity }}
      </div>
      <div class="detail-item">
        <strong>Memory使用量:</strong> {{ node.MemoryUsage }}
      </div>
      <div class="detail-item">
        <strong>Memory使用率:</strong>
        <span :class="{ 'high-usage': node.MemoryUsagePercent > 80 }">
          {{ node.MemoryUsagePercent.toFixed(2) }}%
        </span>
      </div>
      <div class="detail-item">
        <strong>Disk容量:</strong> {{ node.DiskCapacity }}
      </div>
      <div class="detail-item">
        <strong>Disk使用量:</strong> {{ node.DiskUsage }}
      </div>
      <div class="detail-item">
        <strong>Disk使用率:</strong>
        <span :class="{ 'high-usage': node.DiskUsagePercent > 80 }">
          {{ node.DiskUsagePercent.toFixed(2) }}%
        </span>
      </div>
      <div class="detail-item">
        <strong>Network接收量:</strong> {{ node.NetworkReceive }}
      </div>
      <div class="detail-item">
        <strong>Network发送量:</strong> {{ node.NetworkTransmit }}
      </div>
      <div class="detail-item">
        <strong>Load (1/5/15):</strong> {{ node.Load1 }}/{{ node.Load5 }}/{{ node.Load15 }}
      </div>
      <div class="detail-item">
        <strong>Conditions:</strong>
        <el-table :data="formattedConditions" style="width: 100%">
          <el-table-column prop="type" label="Type" width="120"></el-table-column>
          <el-table-column prop="status" label="Status" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.status === 'True' ? 'success' : 'danger'">
                {{ scope.row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="lastTransitionTime" label="Last Transition" width="180"></el-table-column>
          <el-table-column prop="reason" label="Reason" width="150"></el-table-column>
          <el-table-column prop="message" label="Message"></el-table-column>
        </el-table>
      </div>
    </div>
    <div v-else>未找到节点信息</div>
    <el-button @click="goBack">返回节点列表</el-button>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElTable, ElTableColumn, ElTag, ElMessage } from 'element-plus'
import axios from 'axios'

export default {
  components: {
    ElTable,
    ElTableColumn,
    ElTag
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const node = ref(null)
    const loading = ref(true)
    const error = ref(null)

    // 获取当前选择的日期和时间
    const selectedDate = ref(route.query.date || new Date().toISOString().split('T')[0])
    const selectedHour = ref(route.query.hour || new Date().getHours().toString().padStart(2, '0'))
    const selectedCluster = ref(route.query.cluster || '')

    const fetchNodeDetails = async (forceRefresh = false) => {
      loading.value = true
      error.value = null
      try {
        const startTime = `${selectedDate.value}T${selectedHour.value}:00:00`
        const endTime = `${selectedDate.value}T${selectedHour.value}:59:59`
        
        const response = await axios.get(`/cluster-inspection/api/nodes`, {
          params: {
            cluster: selectedCluster.value,
            start_time: startTime,
            end_time: endTime,
            force_refresh: forceRefresh
          }
        })
        
        const nodesData = response.data
        const foundNode = nodesData.find(n => n.Name === route.params.name)

        if (foundNode) {
          node.value = foundNode
          console.log('Node details:', node.value)
        } else {
          throw new Error('Node not found')
        }
      } catch (err) {
        console.error('Error fetching node details:', err)
        error.value = err.message || '获取节点信息失败'
        ElMessage.error(error.value)
      } finally {
        loading.value = false
      }
    }

    onMounted(() => {
      fetchNodeDetails()
    })

    const formattedConditions = computed(() => {
      if (!node.value || !node.value.Conditions) return []
      try {
        const conditions = JSON.parse(node.value.Conditions)
        return conditions.map(condition => ({
          type: condition.type,
          status: condition.status,
          lastTransitionTime: new Date(condition.lastTransitionTime).toLocaleString(),
          reason: condition.reason,
          message: condition.message
        }))
      } catch (error) {
        console.error('Error parsing Conditions:', error)
        return []
      }
    })

    const goBack = () => {
      router.push({ name: 'NodeList' })
    }

    return {
      node,
      loading,
      error,
      goBack,
      formattedConditions,
      selectedDate,
      selectedHour,
      fetchNodeDetails
    }
  }
}
</script>

<style scoped>
.node-details {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  text-align: left;
}

.detail-item {
  margin-bottom: 20px;
}

.el-button {
  margin-top: 20px;
}

.high-usage {
  color: #fff;
  background-color: #ff4d4d;
  padding: 2px 4px;
  border-radius: 4px;
}

.el-table {
  margin-top: 10px;
}
</style>
