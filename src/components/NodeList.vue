<template>
  <div class="node-list" :key="renderKey">
    <div class="header-container">
      <h1>Node List</h1>
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
          :loading="state.loading"
          type="danger"
          class="force-refresh-btn"
        >
          强制刷新
        </el-button>
      </div>
    </div>
    <div v-if="state.loading">Loading...</div>
    <div v-else-if="state.error">{{ state.error }}</div>
    <div v-else>
      <p>Total Nodes: {{ nodes.length }}</p>
      <el-input
        v-model="search"
        placeholder="搜索节点..."
        style="width: 300px; margin-bottom: 20px;"
      />
      <div class="table-container" v-if="filteredNodes.length">
        <el-table :data="filteredNodes" style="width: 100%" @sort-change="handleSortChange">
          <el-table-column prop="Name" label="节点名称" sortable="custom" align="center"></el-table-column>
          <el-table-column prop="CPUCapacity" label="CPU容量" sortable="custom" align="center"></el-table-column>
          <el-table-column prop="CPUUsage" label="CPU使用量" sortable="custom" align="center"></el-table-column>
          <el-table-column 
            prop="CPUUsagePercent"
            label="CPU使用率" 
            sortable="custom"
            :sort-method="(a, b) => sortNumber(a.CPUUsagePercent, b.CPUUsagePercent)"
            align="center"
          >
            <template #default="scope">
              <span :class="{ 'high-usage': scope.row.CPUUsagePercent > 80 }">
                {{ formatPercentage(scope.row.CPUUsagePercent) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="MemoryCapacity" label="Memory容量" sortable="custom" align="center"></el-table-column>
          <el-table-column prop="MemoryUsage" label="Memory使用量" sortable="custom" align="center"></el-table-column>
          <el-table-column 
            prop="MemoryUsagePercent"
            label="Memory使用率" 
            sortable="custom"
            :sort-method="(a, b) => sortNumber(a.MemoryUsagePercent, b.MemoryUsagePercent)"
            align="center"
          >
            <template #default="scope">
              <span :class="{ 'high-usage': scope.row.MemoryUsagePercent > 80 }">
                {{ formatPercentage(scope.row.MemoryUsagePercent) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="DiskCapacity" label="Disk容量" sortable="custom" align="center"></el-table-column>
          <el-table-column prop="DiskUsage" label="Disk使用量" sortable="custom" align="center"></el-table-column>
          <el-table-column 
              prop="DiskUsagePercent"
              label="Disk使用率" 
              sortable="custom"
              :sort-method="(a, b) => sortNumber(a.DiskUsagePercent, b.DiskUsagePercent)"
              align="center"
            >
            <template #default="scope">
              <span :class="{ 'high-usage': scope.row.DiskUsagePercent > 80 }">
                {{ formatPercentage(scope.row.DiskUsagePercent) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="NetworkReceive" label="Network接收量" sortable="custom" align="center"></el-table-column>
          <el-table-column prop="NetworkTransmit" label="Network发送量" sortable="custom" align="center"></el-table-column>
          <el-table-column label="Load (1/5/15)" sortable="custom" align="center">
            <template #default="scope">
              {{ scope.row.Load1 }}/{{ scope.row.Load5 }}/{{ scope.row.Load15 }}
            </template>
          </el-table-column>
          <el-table-column label="健康状态" sortable="custom" align="center">
            <template #default="scope">
              <el-tag :type="scope.row.IsHealthy ? 'success' : 'danger'">
                {{ scope.row.IsHealthy ? '健康' : '不健康' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="详细信息" align="center">
            <template #default="scope">
              <el-button @click="showDetails(scope.row)" size="small" type="primary" plain>Node详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-else>
        <p>No nodes found</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, inject, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

export default {
  setup() {
    const { state } = inject('state')
    const router = useRouter()
    const renderKey = ref(0)
    // 移除 useNavigation
    const selectedCluster = computed(() => state.selectedCluster)

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

    const nodes = computed(() => state.nodes.value || [])

    const search = ref('')
    const sortBy = ref('')
    const sortOrder = ref('ascending')

    const sortNumber = (a, b) => {
      return a - b;
    }

    const formatPercentage = (value) => {
      if (value === undefined || value === null || isNaN(value)) {
        return 'N/A';
      }
      return Number(value).toFixed(2) + '%';
    }

    const filteredNodes = computed(() => {
      console.log('Computing filtered nodes. Total nodes:', nodes.value.length)
      return nodes.value.filter(node => {
        if (!node) return false;
        const searchLower = search.value.toLowerCase();
        return (
          node.Name.toLowerCase().includes(searchLower) ||
          node.CPUCapacity.toLowerCase().includes(searchLower) ||
          node.MemoryCapacity.toLowerCase().includes(searchLower) ||
          node.DiskCapacity.toLowerCase().includes(searchLower)
        )
      })
    })

    const handleSortChange = ({ prop, order }) => {
      sortBy.value = prop;
      sortOrder.value = order;
      
      // 使用 JavaScript 的 sort 方法对 filteredNodes 进行排序
      filteredNodes.value.sort((a, b) => {
        let aValue = a[prop];
        let bValue = b[prop];
        
        // 对于数字类型的值，直接比较
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return order === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        
        // 对于字符串类型的值，可能需要特殊处理
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          // 处理带位的字段（如 GB, MB）
          if (aValue.includes(' ') && bValue.includes(' ')) {
            aValue = parseFloat(aValue.split(' ')[0]);
            bValue = parseFloat(bValue.split(' ')[0]);
          } else {
            // 对于其他字符串，按字母顺序排序
            return order === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
          }
        }
        
        return order === 'ascending' ? aValue - bValue : bValue - aValue;
      });
    }

    const refreshData = async (forceRefresh = false) => {
      if (!selectedCluster.value) return
      state.loading = true
      state.error = null
      try {
        const startTime = `${selectedDate.value}T${selectedHour.value.split(':')[0]}:00:00`
        const endTime = `${selectedDate.value}T${selectedHour.value.split(':')[0]}:59:59`
        
        const response = await axios.get(`/cluster-inspection/api/nodes`, {
          params: {
            cluster: selectedCluster.value,
            start_time: startTime,
            end_time: endTime,
          }
        })
        
        state.nodes.value = response.data
        console.log('Node data refreshed:', state.nodes.value)
        ElMessage.success('节点数据已刷新')
      } catch (error) {
        console.error('Error refreshing node data:', error)
        state.error = '刷新节点数据失败: ' + error.message
        ElMessage.error(state.error)
      } finally {
        state.loading = false
      }
      await nextTick()
      renderKey.value += 1
    }

    const confirmRefresh = () => {
      ElMessageBox.confirm(
        '确定要强制刷新数据吗？这将从服务器获取最新数据。',
        '确认刷新',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
        .then(async () => {
          await refreshData(true)  // 强制刷新
          await refreshData(false) // 再次获取常规数据
        })
        .catch(() => {
          // 用户取消操作，不做任何事
        })
    }

    const onDateTimeChange = () => {
      refreshData()
    }


    const showDetails = (node) => {
      router.push({
        name: 'NodeDetails',
        params: { name: node.Name },
        query: {
          cluster: router.currentRoute.value.query.cluster || selectedCluster.value,
          date: selectedDate.value,
          hour: selectedHour.value.split(':')[0]
        }
      })
    }

    const formatUsage = (value) => {
      if (value === undefined || value === null || isNaN(value)) {
        return 'N/A'
      }
      const numValue = Number(value)
      return isFinite(numValue) ? `${numValue.toFixed(2)}%` : 'N/A'
    }

    watch(() => state.nodes.value, () => {
      // console.log('Nodes updated:', state.nodes.value)
    }, { deep: true })

    // 监听集群变化
    watch(selectedCluster, () => {
      refreshData()
    })

    // 初始加载数据
    onMounted(() => {
      refreshData()
    })

    return {
      state,
      nodes,
      selectedDate,
      selectedHour,
      refreshData,
      onDateTimeChange,
      confirmRefresh,
      showDetails,
      formatUsage,
      renderKey,
      search,
      filteredNodes,
      handleSortChange,
      sortNumber,
      formatPercentage,
      selectedCluster
    }
  }
}
</script>

<style scoped>
.node-list {
  max-width: 100%;
  margin: 0 auto;
  padding: 20px;
}

.header-container {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  margin-bottom: 20px;
}

h1 {
  margin: 0;
  text-align: center;
  flex-grow: 1;
}

.controls {
  position: absolute;
  right: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.force-refresh-btn {
  margin-left: 10px;
}

.high-usage {
  color: #fff;
  background-color: #ff4d4d;
  padding: 2px 4px;
  border-radius: 4px;
}

.el-date-picker,
.el-select {
  width: 140px;
}
</style>
