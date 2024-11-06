import { watch } from 'vue'
import { useStore } from '../store'

export function useClusterWatch(refreshFunction) {
  const { state } = useStore()

  watch(() => state.selectedCluster, (newCluster, oldCluster) => {
    if (newCluster && newCluster !== oldCluster) {
      console.log('集群已切换:', newCluster)
      refreshFunction(false)  // 使用 false 表示非强制刷新
    }
  })
}
