# 集群巡检项目前端

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### 集群名称映射

store.js

```js
// 集群名称映射,需要与后端保持一致
const clusterNameMap = {
  '': '',
  '': '',
}
```


config.yaml

```yaml
clusters:
  - name: production-cluster
    kubeconfig: ./production-cluster.yaml
    #prometheus地址
    prometheus: http://127.0.0.1:9091
    #prometheus token,如果prometheus开启了认证则需要填写,否则为空
    prometheus_token: ""
    #如果配合前端项目使用，集群名称映射的名字需要与这里一致
    ClusterName: ""

  - name: staging-cluster
    kubeconfig: ./staging-cluster.yaml
    prometheus: http://127.0.0.1:9090
    prometheus_token: ""
    #如果配合前端项目使用，集群名称映射的名字需要与这里一致
    ClusterName: ""
database:
  user: ""
  password: ''
  host: ""
  port: ""
  dbname: ""
```
