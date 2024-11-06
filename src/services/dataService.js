import axios from 'axios'

const BASE_URL = '/cluster-inspection/api'

export const dataService = {
  async fetchData(endpoint, params, forceRefresh = false) {
    const url = forceRefresh ? `${BASE_URL}/report/${endpoint}` : `${BASE_URL}/${endpoint}`
    
    // 格式化时间
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toISOString().split('.')[0] + 'Z';
    };

    // 更新参数中的时间格式
    if (params.start_time) {
      params.start_time = formatDate(params.start_time);
    }
    if (params.end_time) {
      params.end_time = formatDate(params.end_time);
    }

    try {
      const response = await axios.get(url, { params })
      return response.data
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error)
      throw error
    }
  },

  fetchNodes(cluster, startTime, endTime, forceRefresh) {
    return this.fetchData('nodes', { cluster, start_time: startTime, end_time: endTime }, forceRefresh)
  },

  fetchPods(cluster, startTime, endTime, forceRefresh) {
    return this.fetchData('pods', { cluster, start_time: startTime, end_time: endTime }, forceRefresh)
  },

  fetchEvents(cluster, startTime, endTime, forceRefresh) {
    return this.fetchData('events', { cluster, start_time: startTime, end_time: endTime }, forceRefresh)
  }
}
