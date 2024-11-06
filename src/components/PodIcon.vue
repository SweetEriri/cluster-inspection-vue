<template>
  <el-tooltip :content="tooltipContent" placement="top">
    <div class="pod-icon" :class="{ 'high-usage': isHighUsage }">
      {{ podInitials }}
    </div>
  </el-tooltip>
</template>

<script>
import { computed } from 'vue'

export default {
  props: {
    pod: { type: Object, required: true }
  },
  setup(props) {
    const isHighUsage = computed(() => {
      const cpu = parseFloat(props.pod?.CPUUsagePercentMax) || 0
      const memory = parseFloat(props.pod?.MemoryUsagePercentMax) || 0
      return cpu > 80 || memory > 80
    })

    const podInitials = computed(() => {
      const name = props.pod?.Name || ''
      return name.slice(0, 2).toUpperCase()
    })

    const tooltipContent = computed(() => {
      if (!props.pod) return 'Pod 信息不可用'
      return `
        Pod: ${props.pod.Name || 'Unknown'}
        CPU 使用率: ${props.pod.CPUUsagePercentMax || 'N/A'}%
        内存使用率: ${props.pod.MemoryUsagePercentMax || 'N/A'}%
        状态: ${props.pod.Status || 'Unknown'}
      `
    })

    return {
      isHighUsage,
      podInitials,
      tooltipContent
    }
  }
}
</script>

<style scoped>
.pod-icon {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: #409EFF;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  font-weight: bold;
  margin-right: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.pod-icon:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.pod-icon.high-usage {
  background-color: #F56C6C;
}
</style>
