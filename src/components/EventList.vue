<template>
  <div class="event-list" :key="renderKey">
    <div class="header-container">
      <h1>Event List</h1>
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
      <p>Total Events: {{ events.length }}</p>
      <input v-model="search" placeholder="Search events..." class="search-input">
      <el-table
        v-if="filteredEvents.length"
        :data="filteredEvents"
        style="width: 100%"
        :default-sort = "{prop: 'LastTimestamp', order: 'descending'}"
      >
      <el-table-column prop="Type" label="Type" sortable>
  <template #default="scope">
    <el-tag :type="getEventTypeTagType(scope.row.Type)">{{ scope.row.Type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="Reason" label="Reason" sortable />
        <el-table-column label="Object" sortable>
          <template #default="scope">
            <template v-if="scope.row.InvolvedObject">
              <a @click.prevent="navigateToResourceDetails(scope.row)" href="#">
                {{ getObjectName(scope.row.InvolvedObject) }}
              </a>
            </template>
            <span v-else>N/A</span>
          </template>
        </el-table-column>
        <el-table-column prop="Message" label="Message" />
        <el-table-column prop="Time" label="Time" sortable>
          <template #default="scope">
            {{ formatTimestamp(scope.row) }}
          </template>
        </el-table-column>
        <el-table-column>
          <template #default="scope">
            <el-button @click="navigateToPodDetails(scope.row)" v-if="scope.row.InvolvedObject && scope.row.InvolvedObject.Kind === 'Pod'">
              查看 Pod 详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-else>No events found</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, inject } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import axios from 'axios'

export default {
  setup() {
    const { state } = inject('state')
    const router = useRouter()
    const search = ref('')
    const renderKey = ref(0)

    const selectedCluster = computed(() => state.selectedCluster)

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

    const events = computed(() => state.events[selectedCluster.value] || [])

    const refreshData = async (forceRefresh = false) => {
      if (!selectedCluster.value) return
      state.loading = true
      state.error = null
      try {
        const startTime = `${selectedDate.value}T${selectedHour.value.split(':')[0]}:00:00`
        const endTime = `${selectedDate.value}T${selectedHour.value.split(':')[0]}:59:59`
        
        const response = await axios.get(`/cluster-inspection/api/events`, {
          params: {
            cluster: selectedCluster.value,
            start_time: startTime,
            end_time: endTime,
          }
        })
        
        state.events[selectedCluster.value] = response.data
      } catch (error) {
        console.error('Error refreshing event data:', error)
        state.error = '刷新事件数据失败: ' + error.message
        ElMessage.error(state.error)
      } finally {
        state.loading = false
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

    const formatTimestamp = (event) => {
      const time = event.Time;
      
      if (!time || time === "0001-01-01T00:00:00Z") {
        return 'N/A';
      }
      
      // 直接返回原始的 Time 值
      return time;
    };

    const getObjectName = (involvedObjectString) => {
      try {
        const involvedObject = typeof involvedObjectString === 'string' 
          ? JSON.parse(involvedObjectString) 
          : involvedObjectString;
        const kind = involvedObject.kind || 'Unknown';
        const name = involvedObject.name || 'Unknown';
        return `${kind}/${name}`;
      } catch (error) {
        console.error('Error parsing InvolvedObject:', error);
        return 'Unknown/Unknown';
      }
    }

    const getEventTypeTagType = (type) => {
      switch (type) {
        case 'Normal':
          return 'success'
        case 'Warning':
          return 'warning'
        default:
          return 'info'
      }
    }

    const filteredEvents = computed(() => {
      console.log('Computing filtered events. Total events:', events.value.length)
      return events.value.filter(event => {
        if (!event) return false;
        const searchLower = search.value.toLowerCase();
        let involvedObject;
        try {
          involvedObject = typeof event.InvolvedObject === 'string' 
            ? JSON.parse(event.InvolvedObject) 
            : event.InvolvedObject;
        } catch (error) {
          console.error('Error parsing InvolvedObject:', error);
          involvedObject = {};
        }
        return (
          (event.Type && event.Type.toLowerCase().includes(searchLower)) ||
          (event.Reason && event.Reason.toLowerCase().includes(searchLower)) ||
          (involvedObject.name && involvedObject.name.toLowerCase().includes(searchLower)) ||
          (event.Message && event.Message.toLowerCase().includes(searchLower))
        )
      })
    })

    // 监听集群变化
    watch(selectedCluster, () => {
      refreshData()
    })

    // 初始加载数据
    refreshData()

    const navigateToResourceDetails = (event) => {
      if (!event.InvolvedObject) {
        ElMessage.warning('No involved object information available');
        return;
      }

      let involvedObject;
      try {
        involvedObject = typeof event.InvolvedObject === 'string' 
          ? JSON.parse(event.InvolvedObject) 
          : event.InvolvedObject;
      } catch (error) {
        console.error('Error parsing InvolvedObject:', error);
        ElMessage.error('Error parsing resource information');
        return;
      }

      const query = {
        cluster: state.selectedCluster,
        date: selectedDate.value,
        hour: selectedHour.value.split(':')[0],
      };

      switch (involvedObject.kind) {
        case 'Pod':
          router.push({
            name: 'PodDetails',
            params: { 
              name: involvedObject.name
            },
            query: {
              ...query,
              namespace: involvedObject.namespace
            }
          });
          break;
        case 'Node':
          router.push({
            name: 'NodeDetails',
            params: { name: involvedObject.name },
            query: query
          });
          break;
        default:
          ElMessage.warning(`Navigation to ${involvedObject.kind} details is not supported`);
      }
    }

    return {
      state,
      events,
      search,
      filteredEvents,
      selectedDate,
      selectedHour,
      refreshData,
      onDateTimeChange,
      confirmRefresh,
      formatTimestamp,
      getObjectName,
      navigateToResourceDetails,
      getEventTypeTagType,  
      renderKey 
    }
  }
}
</script>

<style scoped>
.event-list {
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

.search-input {
  margin-bottom: 20px;
  padding: 10px;
  width: 100%;
  max-width: 300px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.el-table {
  margin-top: 20px;
}

.el-tag {
  font-size: 12px;
}

a {
  color: #409eff;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.el-date-picker,
.el-select {
  width: 140px;
}
</style>