<template>
  <div class="resource-usage-chart">
    <h3>{{ title }}</h3>
    <div class="chart-container">
      <div class="chart current">
        <h4>当前配置</h4>
        <div class="circle-chart">
          <div class="circle limit" :style="circleStyle(currentLimitScale)" @mouseover="showTooltip($event, 'limit', limitUsage)" @mouseout="hideTooltip">
            <span class="tooltip">限制: {{ formatUsage(limitUsage) }}</span>
          </div>
          <div class="circle request" :style="circleStyle(currentRequestScale)" @mouseover="showTooltip($event, 'request', requestUsage)" @mouseout="hideTooltip">
            <span class="tooltip">请求: {{ formatUsage(requestUsage) }}</span>
          </div>
          <div class="circle usage" :style="circleStyle(usageScale)" @mouseover="showTooltip($event, 'usage', currentUsage)" @mouseout="hideTooltip">
            <span class="tooltip">使用: {{ formatUsage(currentUsage) }}</span>
          </div>
        </div>
        <div class="chart-labels">
          <div><span class="color-dot usage"></span>使用: {{ formatUsage(currentUsage) }}</div>
          <div><span class="color-dot request"></span>请求: {{ formatUsage(requestUsage) }}</div>
          <div><span class="color-dot limit"></span>限制: {{ formatUsage(limitUsage) }}</div>
        </div>
      </div>
      <div class="chart suggested">
        <h4>建议配置</h4>
        <div class="circle-chart">
          <div class="circle limit" :style="circleStyle(suggestedLimitScale)">
            <span class="tooltip">建议限制: {{ formatUsage(displaySuggestedLimitUsage) }}</span>
          </div>
          <div class="circle request" :style="circleStyle(suggestedRequestScale)">
            <span class="tooltip">建议请求: {{ formatUsage(displaySuggestedRequestUsage) }}</span>
          </div>
          <div class="circle usage" :style="circleStyle(usageScale)">
            <span class="tooltip">使用: {{ formatUsage(currentUsage) }}</span>
          </div>
        </div>
        <div class="chart-labels">
          <div><span class="color-dot usage"></span>使用: {{ formatUsage(currentUsage) }}</div>
          <div><span class="color-dot request"></span>建议请求: {{ formatUsage(displaySuggestedRequestUsage) }}</div>
          <div><span class="color-dot limit"></span>建议限制: {{ formatUsage(displaySuggestedLimitUsage) }}</div>
        </div>
      </div>
    </div>
    <div class="comparison-table">
      <table>
        <thead>
          <tr>
            <th></th>
            <th>当前值</th>
            <th>建议值</th>
            <th>变化</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>请求</td>
            <td>{{ formatUsage(requestUsage) }}</td>
            <td>{{ formatUsage(displaySuggestedRequestUsage) }}</td>
            <td :class="getChangeClass(requestUsage, displaySuggestedRequestUsage)">
              {{ getChangePercentage(requestUsage, displaySuggestedRequestUsage) }}
            </td>
          </tr>
          <tr>
            <td>限制</td>
            <td>{{ formatUsage(limitUsage) }}</td>
            <td>{{ formatUsage(displaySuggestedLimitUsage) }}</td>
            <td :class="getChangeClass(limitUsage, displaySuggestedLimitUsage)">
              {{ getChangePercentage(limitUsage, displaySuggestedLimitUsage) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="optimization-summary">
      {{ getOptimizationSummary() }}
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import { normalizeMemoryValue, formatMemory } from '@/utils/memoryUnitConversion'

export default {
  props: {
    title: { type: String, required: true },
    resourceType: { type: String, required: true }, // 'cpu' 或 'memory'
    currentUsage: { type: Number, default: 0 },
    requestUsage: { type: Number, default: 0 },
    limitUsage: { type: Number, default: 0 },
    suggestedRequestUsage: { type: Number, default: 0 },
    suggestedLimitUsage: { type: Number, default: 0 },
    unit: { type: String, default: '' },
    suggestedUnit: { type: String, default: '' }
  },
  setup(props) {
    const isMemory = computed(() => props.resourceType === 'memory')

    const normalizeValue = (value, unit) => {
      return isMemory.value ? normalizeMemoryValue(value, unit) : value
    }

    const normalizedCurrentUsage = computed(() => normalizeValue(props.currentUsage, props.unit))
    const normalizedRequestUsage = computed(() => normalizeValue(props.requestUsage, props.unit))
    const normalizedLimitUsage = computed(() => normalizeValue(props.limitUsage, props.unit))
    const normalizedSuggestedRequestUsage = computed(() => {
      if (props.suggestedRequestUsage === null || props.suggestedRequestUsage === '无需调整') {
        return normalizedRequestUsage.value;
      }
      return normalizeValue(props.suggestedRequestUsage, props.suggestedUnit);
    })
    const normalizedSuggestedLimitUsage = computed(() => {
      if (props.suggestedLimitUsage === null || props.suggestedLimitUsage === '无需调整') {
        return normalizedLimitUsage.value;
      }
      return normalizeValue(props.suggestedLimitUsage, props.suggestedUnit);
    })

    const maxValue = computed(() => Math.max(
      normalizedLimitUsage.value,
      normalizedSuggestedLimitUsage.value,
      normalizedCurrentUsage.value
    ))

    const getScale = (value) => (value / maxValue.value) * 100

    const usageScale = computed(() => getScale(normalizedCurrentUsage.value))
    const currentRequestScale = computed(() => getScale(normalizedRequestUsage.value))
    const currentLimitScale = computed(() => getScale(normalizedLimitUsage.value))
    const suggestedLimitScale = computed(() => getScale(normalizedSuggestedLimitUsage.value))

    const formatUsage = (usage, unit = props.unit) => {
      if (usage === null || usage === undefined) {
        return '未设置';
      }
      if (typeof usage === 'string' && usage === '无需调整') {
        return formatUsage(props.requestUsage, unit);
      }
      return isMemory.value ? formatMemory(usage, unit) : `${Number(usage).toFixed(2)}${unit}`;
    }

    const getChangePercentage = (current, suggested) => {
      if (suggested === null || suggested === '无需调整' || current === suggested) {
        return '无变化';
      }
      if (current === 0 && suggested > 0) {
        return '+Infinity%';
      }
      if (current > 0 && suggested === 0) {
        return '-100%';
      }
      const change = ((suggested - current) / current) * 100;
      return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
    }

    const getChangeClass = (current, suggested) => {
      const change = suggested - current
      return change > 0 ? 'increase' : 'decrease'
    }

    const getOptimizationSummary = () => {
      if (!hasSuggestedRequest.value && !hasSuggestedLimit.value) {
        return '当前配置已经合理，无需调整。';
      }
      const requestChange = props.suggestedRequestUsage - props.requestUsage
      const limitChange = props.suggestedLimitUsage - props.limitUsage
      
      if (requestChange > 0 && limitChange > 0) {
        return '建议增加资源分配以满足实际使用需求，提高性能和稳定性。'
      } else if (requestChange < 0 && limitChange < 0) {
        return '建议减少资源分配以提高集群资源利用率，避免资源浪费。'
      } else {
        return '建议调整资源配置以优化性能和资源利用，使其更贴近实际使用情况。'
      }
    }

    const circleStyle = (scale) => ({
      width: `${scale}%`,
      height: `${scale}%`,
      top: `${(100 - scale) / 2}%`,
      left: `${(100 - scale) / 2}%`
    })

    const showTooltip = (event, type, value) => {
      const tooltip = event.target.querySelector('.tooltip')
      if (tooltip) {
        tooltip.style.display = 'block'
      }
    }

    const hideTooltip = (event) => {
      const tooltip = event.target.querySelector('.tooltip')
      if (tooltip) {
        tooltip.style.display = 'none'
      }
    }

    const hasSuggestedRequest = computed(() => props.suggestedRequestUsage !== null)
    const hasSuggestedLimit = computed(() => props.suggestedLimitUsage !== null)

    const suggestedRequestScale = computed(() => 
      hasSuggestedRequest.value ? getScale(normalizedSuggestedRequestUsage.value) : currentRequestScale.value
    )

    const displaySuggestedRequestUsage = computed(() => {
      if (props.suggestedRequestUsage === null || props.suggestedRequestUsage === '无需调整') {
        return props.requestUsage;
      }
      return props.suggestedRequestUsage;
    })

    const displaySuggestedLimitUsage = computed(() => {
      if (props.suggestedLimitUsage === null || props.suggestedLimitUsage === '无需调整') {
        return props.limitUsage;
      }
      return props.suggestedLimitUsage;
    })

    return {
      usageScale,
      currentRequestScale,
      currentLimitScale,
      suggestedRequestScale,
      suggestedLimitScale,
      formatUsage,
      getChangePercentage,
      getChangeClass,
      getOptimizationSummary,
      circleStyle,
      showTooltip,
      hideTooltip,
      normalizedCurrentUsage,
      normalizedRequestUsage,
      normalizedLimitUsage,
      normalizedSuggestedRequestUsage,
      normalizedSuggestedLimitUsage,
      hasSuggestedRequest,
      hasSuggestedLimit,
      displaySuggestedRequestUsage,
      displaySuggestedLimitUsage
    }
  }
}
</script>

<style scoped>
.resource-usage-chart {
  font-family: Arial, sans-serif;
  margin-bottom: 20px;
  max-width: 800px;
  margin: 0 auto;
}
.chart-container {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
}
.chart {
  text-align: center;
  width: 45%;
}
.circle-chart {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 20px;
}
.circle {
  position: absolute;
  border-radius: 50%;
  transition: all 0.3s ease;
  cursor: pointer;
}
.circle.limit { background-color: rgba(255, 193, 7, 0.6); z-index: 1; }
.circle.request { background-color: rgba(76, 175, 80, 0.6); z-index: 2; }
.circle.usage { background-color: rgba(33, 150, 243, 0.6); z-index: 3; }
.chart-labels {
  text-align: left;
  margin-left: 20px;
}
.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
}
.color-dot.usage { background-color: rgba(33, 150, 243, 1); }
.color-dot.request { background-color: rgba(76, 175, 80, 1); }
.color-dot.limit { background-color: rgba(255, 193, 7, 1); }
.tooltip {
  display: none;
  position: absolute;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 10;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}
.comparison-table {
  margin-bottom: 20px;
}
.comparison-table table {
  width: 100%;
  border-collapse: collapse;
}
.comparison-table th, .comparison-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}
.comparison-table th {
  background-color: #f2f2f2;
}
.increase { color: #4CAF50; }
.decrease { color: #F44336; }
.optimization-summary {
  font-weight: bold;
  text-align: center;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 5px;
}
.chart-labels div {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}
.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
}
.color-dot.usage { background-color: rgba(33, 150, 243, 0.8); }
.color-dot.request { background-color: rgba(76, 175, 80, 0.8); }
.color-dot.limit { background-color: rgba(255, 193, 7, 0.8); }
.circle.limit, .circle.request {
  opacity: 0.6;
  transition: opacity 0.3s ease;
}
.circle.limit:not(:hover), .circle.request:not(:hover) {
  opacity: 0.4;
}
.chart-labels div {
  opacity: 1;
  transition: opacity 0.3s ease;
}
.chart-labels div:not(:first-child) {
  opacity: 0.7;
}
</style>
