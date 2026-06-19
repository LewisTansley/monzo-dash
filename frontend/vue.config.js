const { defineConfig } = require('@vue/cli-service')

const devPublicHost = process.env.DEV_PUBLIC_HOST || ''
const hmrMode =
  process.env.VUE_DEV_HMR_MODE ||
  (process.env.ENABLE_TAILSCALE_SERVE === '1' ? 'serve' : 'direct')

function devServerClientWebSocketURL() {
  if (hmrMode === 'serve' && devPublicHost && devPublicHost !== 'localhost') {
    return {
      protocol: 'wss',
      hostname: devPublicHost,
      port: 443,
      pathname: '/ws'
    }
  }
  // Direct tailnet/LAN: auto tracks the browser URL (MagicDNS, 100.x, localhost).
  // If your webpack-dev-server rejects it, set VUE_DEV_HMR_EXPLICIT=1 for ws://<host>:<port>/ws.
  if (process.env.VUE_DEV_HMR_EXPLICIT === '1') {
    const port = Number(process.env.FRONTEND_PORT) || 8090
    const host =
      devPublicHost && devPublicHost !== 'localhost' ? devPublicHost : 'localhost'
    return { protocol: 'ws', hostname: host, port, pathname: '/ws' }
  }
  return 'auto://0.0.0.0:0/ws'
}

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.API_PORT || 3001}`,
        changeOrigin: true
      }
    },
    host: '0.0.0.0',
    port: Number(process.env.FRONTEND_PORT) || 8090,
    allowedHosts: 'all',
    client: {
      webSocketURL: devServerClientWebSocketURL()
    }
  },
  chainWebpack: config => {
    config.plugin('define').tap(definitions => {
      Object.assign(definitions[0], {
        __VUE_OPTIONS_API__: 'true',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
      })
      return definitions
    })
  }
})
