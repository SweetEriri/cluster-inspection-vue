<template>
  <div id="app">
    <div v-if="!isInitialized">初始化中...</div>
    <div v-else>
      <div class="header">
        <nav>
          <router-link to="/">概览</router-link> |
          <router-link to="/nodes">节点</router-link> |
          <router-link to="/pods">服务</router-link> |
          <router-link to="/events">事件</router-link> |
          <router-link to="/report">聚合报告</router-link> |
          <router-link to="/recommendations">资源推荐</router-link>
        </nav>
        <div v-if="showClusterSelector" class="cluster-selector">
          <el-select v-model="state.selectedCluster" @change="handleClusterChange" placeholder="选择集群" size="small">
            <el-option
              v-for="cluster in state.clusters"
              :key="cluster"
              :label="state.clusterNames[cluster] || cluster"
              :value="cluster"
            >
            </el-option>
          </el-select>
        </div>
      </div>
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, inject, watch, onErrorCaptured } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

export default {
  name: 'App',
  setup() {
    const { state, initialize, setSelectedCluster } = inject('state')
    const route = useRoute()
    const isInitialized = ref(false)

    const showClusterSelector = computed(() => {
      return !['NodeDetails', 'PodDetails'].includes(route.name)
    })

    onMounted(async () => {
      try {
        await initialize()
        isInitialized.value = true
      } catch (err) {
        console.error('Initialization failed:', err)
        ElMessage.error('初始化失败，请刷新页面重试')
      }
    })

    const handleClusterChange = (cluster) => {
      setSelectedCluster(cluster)
    }

    onErrorCaptured((err, instance, info) => {
      console.error('Captured error:', err, instance, info)
      ElMessage.error(`An error occurred: ${err.message}`)
      return false // 防止错误继续传播
    })

    return {
      state,
      handleClusterChange,
      isInitialized,
      showClusterSelector
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

nav {
  display: flex;
  gap: 20px;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
  text-decoration: none;
}

nav a.router-link-exact-active {
  color: #42b983;
}

.cluster-selector {
  min-width: 200px;
  margin-left: 20px;  
}

.el-select {
  width: 100%;
}
</style>
