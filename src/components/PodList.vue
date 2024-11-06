<template>
  <div class="pod-list">
    <div class="header-container">
      <h1>Pod List</h1>
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
    <div v-else-if="state.error">{{ state.error }}</div>
    <div v-else-if="!pods || pods.length === 0">No pods found</div>
    <div v-else>
      <el-input
        v-model="searchQuery"
        placeholder="搜索 Owner、Namespace、Kind 或 Pod IP"
        style="margin-bottom: 20px; width: 300px;"
      />
      <p class="total-owners">Total Owners: {{ filteredGroupedPods.length }}</p>
      <el-table 
        :data="paginatedGroupedPods" 
        style="width: 100%" 
        row-key="ownerName"
        :expand-row-keys="expandedRows"
        @expand-change="handleExpandChange"
        @sort-change="handleSortChange"
        @row-click="handleRowClick"
        :default-sort="{ prop: 'ownerName', order: 'ascending' }"
      >
        <el-table-column type="expand">
          <template #default="props">
            <el-table :data="props.row.pods" style="width: 100%" row-key="Name">
              <el-table-column prop="Name" label="Pod Name" min-width="180"></el-table-column>
              <el-table-column prop="Namespace" label="Namespace" min-width="120"></el-table-column>
              <el-table-column prop="PodIP" label="Pod IP" min-width="120">
                <template #default="scope">
                  <span v-html="highlightText(scope.row.PodIP, searchQuery.value)"></span>
                </template>
              </el-table-column>
              <el-table-column label="Status" min-width="100">
                <template #default="scope">
                  <el-tag :type="getPodStatusType(scope.row.Status)">{{ scope.row.Status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="CPU Usage % (Max)" min-width="140">
                <template #default="scope">
                  <span :class="getUsageClass(scope.row.cpuUsagePercentMax, 80)">
                    {{ formatUsage(scope.row.cpuUsagePercentMax) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="CPU Usage % (Min)" min-width="140">
                <template #default="scope">
                  {{ scope.row.cpuUsagePercentMin !== null ? formatUsage(scope.row.cpuUsagePercentMin) : 'N/A' }}
                </template>
              </el-table-column>
              <el-table-column label="Memory Usage % (Max)" min-width="160">
                <template #default="scope">
                  <span :class="getUsageClass(scope.row.memoryUsagePercentMax, 80)">
                    {{ formatUsage(scope.row.memoryUsagePercentMax) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="Memory Usage % (Min)" min-width="160">
                <template #default="scope">
                  {{ scope.row.memoryUsagePercentMin !== null ? formatUsage(scope.row.memoryUsagePercentMin) : 'N/A' }}
                </template>
              </el-table-column>
              <el-table-column label="Restart Count" min-width="120">
                <template #default="scope">
                  <span :class="getUsageClass(scope.row.RestartCount, 3)">
                    {{ scope.row.RestartCount }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="Health Status" min-width="120">
                <template #default="scope">
                  <el-tag :type="getHealthStatusType(scope.row)">
                    {{ getHealthStatus(scope.row) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="Actions" width="100" fixed="right">
                <template #default="scope">
                  <el-button @click.stop="navigateToPodDetails(scope.row)" size="small" type="primary" plain>详情</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="ownerName" label="Owner" min-width="180" sortable="custom">
          <template #default="scope">
            <span :class="{ 'unhealthy-owner': hasUnhealthyPods(scope.row) }">{{ scope.row.ownerName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="podCount" label="Pod Count" min-width="120" sortable="custom"></el-table-column>
        <el-table-column prop="namespace" label="Namespace" min-width="120" sortable="custom"></el-table-column>
        <el-table-column prop="kind" label="Kind" min-width="120" sortable="custom"></el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
          :current-page="currentPage"
          :page-sizes="[10, 20, 50, 100]"
          :page-size="pageSize"
          layout="total, sizes, prev, pager, next, jumper"
          :total="filteredGroupedPods.length"
        >
        </el-pagination>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useStore } from '../store'
import { useRouter, useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import axios from 'axios'

export default {
  setup() {
    const router = useRouter()
    const route = useRoute()
    const { state, fetchPods } = useStore()
    const selectedCluster = computed(() => state.selectedCluster)
    const pods = ref([])
    const isLoading = ref(false)
    const searchQuery = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const sortBy = ref('')
    const sortOrder = ref('ascending')
    const expandedRows = ref([])
    const renderKey = ref(0)

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

    const updateDateTime = () => {
      selectedDate.value = currentDate.value;
      selectedHour.value = currentHour.value;
    };

    const groupedPods = computed(() => {
      // console.log('Computing groupedPods with:', pods.value);
      if (!Array.isArray(pods.value) || pods.value.length === 0) {
        // console.log('No pods data available');
        return [];
      }
      const groups = {};
      pods.value.forEach(pod => {
        const ownerName = pod.OwnerName || 'Standalone';
        if (!groups[ownerName]) {
          groups[ownerName] = {
            ownerName,
            podCount: 0,
            namespace: pod.Namespace,
            kind: pod.Category || pod.Kind,
            pods: []
          };
        }
        groups[ownerName].podCount++;
        groups[ownerName].pods.push(pod);
      });
      const result = Object.values(groups);
      // console.log('Grouped pods result:', result);
      return result;
    });

    const filteredGroupedPods = computed(() => {
      let result = groupedPods.value;
      
      if (searchQuery.value) {
        const searchTerm = searchQuery.value.toLowerCase();
        result = result.map(group => {
          // 首先检查是否有匹配的 pod
          const matchingPods = group.pods.filter(pod => 
            pod.PodIP?.toLowerCase().includes(searchTerm) ||
            group.ownerName.toLowerCase().includes(searchTerm) ||
            group.namespace.toLowerCase().includes(searchTerm) ||
            group.kind.toLowerCase().includes(searchTerm)
          );

          if (matchingPods.length > 0) {
            // 如果有匹配的 pod，返回修改后的组
            return {
              ...group,
              pods: matchingPods,
              podCount: matchingPods.length
            };
          }
          return null;
        }).filter(Boolean); // 移除空值
      }
      
      // 应用排序逻辑保持不变
      if (sortBy.value) {
        result = result.slice().sort((a, b) => {
          let aValue = a[sortBy.value];
          let bValue = b[sortBy.value];
          
          if (sortBy.value === 'podCount') {
            aValue = Number(aValue);
            bValue = Number(bValue);
          }
          
          if (aValue < bValue) return sortOrder.value === 'ascending' ? -1 : 1;
          if (aValue > bValue) return sortOrder.value === 'ascending' ? 1 : -1;
          return 0;
        });
      }
      
      return result;
    });

    const paginatedGroupedPods = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      return filteredGroupedPods.value.slice(start, end)
    })

    const formatUsage = (value) => {
      return value != null && !isNaN(value) ? value.toFixed(2) + '%' : 'N/A'
    }

    const getHealthStatus = (pod) => {
      if (pod.cpuUsagePercentMax > 80 || pod.memoryUsagePercentMax > 80) {
        return 'Unhealthy'
      }
      if (pod.RestartCount > 3) {
        return 'Warning'
      }
      return 'Healthy'
    }

    const getHealthStatusType = (pod) => {
      const status = getHealthStatus(pod)
      switch (status) {
        case 'Healthy': return 'success'
        case 'Warning': return 'warning'
        case 'Unhealthy': return 'danger'
        default: return 'info'
      }
    }

    const getPodStatusType = (status) => {
      switch (status) {
        case 'Running': return 'success'
        case 'Pending': return 'warning'
        case 'Failed': return 'danger'
        default: return 'info'
      }
    }

    const hasUnhealthyPods = (group) => {
      return group.pods.some(pod => getHealthStatus(pod) !== 'Healthy')
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
      });
    };

    const refreshData = async (forceRefresh = false) => {
      if (!selectedCluster.value) return
      isLoading.value = true
      state.error = null
      try {
        const startTime = `${selectedDate.value}T${selectedHour.value.split(':')[0]}:00:00`
        const endTime = `${selectedDate.value}T${selectedHour.value.split(':')[0]}:59:59`
        
        const response = await axios.get(`/cluster-inspection/api/pods`, {
          params: {
            cluster: selectedCluster.value,
            start_time: startTime,
            end_time: endTime,
          }
        })
        
        pods.value = response.data
        console.log('Pod data refreshed:', pods.value)
        ElMessage.success('Pod 数据已刷新')
      } catch (error) {
        console.error('Error refreshing pod data:', error)
        state.error = '刷新 Pod 数据失败: ' + error.message
        ElMessage.error(state.error)
      } finally {
        isLoading.value = false
      }
      await nextTick()
      renderKey.value += 1
    }

    const onDateTimeChange = () => {
      refreshData()
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

    const handleSizeChange = (val) => {
      pageSize.value = val
      currentPage.value = 1
    }

    const handleCurrentChange = (val) => {
      currentPage.value = val
    }

    const handleSortChange = ({ prop, order }) => {
      sortBy.value = prop
      sortOrder.value = order
    }

    const isCPUUsageUnhealthy = (value) => value > 80
    const isMemoryUsageUnhealthy = (value) => value > 80
    const isRestartCountUnhealthy = (value) => value > 3

    const getUsageClass = (value, threshold) => {
      return value > threshold ? 'unhealthy-field' : ''
    }

    const handleExpandChange = (row, expanded) => {
      if (expanded) {
        if (!expandedRows.value.includes(row.ownerName)) {
          expandedRows.value.push(row.ownerName)
        }
      } else {
        const index = expandedRows.value.indexOf(row.ownerName)
        if (index !== -1) {
          expandedRows.value.splice(index, 1)
        }
      }
    }

    const handleRowClick = (row) => {
      handleExpandChange(row, !expandedRows.value.includes(row.ownerName))
    }

    onMounted(() => {
      console.log('PodList component mounted')
      refreshData()
    })

    watch(() => state.selectedCluster, (newCluster, oldCluster) => {
      console.log('Selected cluster changed:', newCluster)
      if (newCluster && newCluster !== oldCluster) {
        refreshData()
      }
    })

    const highlightText = (text, search) => {
      if (!search || !text) return text;
      const regex = new RegExp(`(${search})`, 'gi');
      return text.replace(regex, '<span class="highlight">$1</span>');
    };

    return {
      state,
      pods,
      isLoading,
      searchQuery,
      currentPage,
      pageSize,
      sortBy,
      sortOrder,
      filteredGroupedPods,
      paginatedGroupedPods,
      formatUsage,
      getHealthStatus,
      getHealthStatusType,
      getPodStatusType,
      hasUnhealthyPods,
      navigateToPodDetails,
      refreshData,
      handleSizeChange,
      handleCurrentChange,
      handleSortChange,
      isCPUUsageUnhealthy,
      isMemoryUsageUnhealthy,
      isRestartCountUnhealthy,
      getUsageClass,
      expandedRows,
      handleExpandChange,
      handleRowClick,
      selectedDate,
      selectedHour,
      onDateTimeChange,
      confirmRefresh,
      selectedCluster,
      navigateToPodDetails,
      renderKey,
      highlightText
    }
  }
}
</script>

<style scoped>
.pod-list {
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

.force-refresh-btn {
  background-color: #f56c6c;
  border-color: #f56c6c;
}

.force-refresh-btn:hover {
  background-color: #f78989;
  border-color: #f78989;
}

.total-owners {
  font-size: 14px;
  color: #606266;
  margin-bottom: 10px;
}

:deep(.el-table) {
  --el-table-border-color: #ebeef5;
  --el-table-header-background-color: #f5f7fa;
}

:deep(.el-table__expanded-cell) {
  padding: 20px !important;
}

:deep(.el-table__expand-icon) {
  font-size: 16px;
}

.unhealthy-owner {
  color: #f56c6c;
  font-weight: bold;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.unhealthy-field {
  color: #f56c6c;
  font-weight: bold;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.el-date-picker,
.el-select {
  width: 140px;
}

:deep(.highlight) {
  background-color: #ffd04b;
  padding: 2px;
  border-radius: 2px;
}
</style>

