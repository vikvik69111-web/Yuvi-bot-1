module.exports = {
  apps: [
    {
      name: 'yuvi-bot',
      script: 'index.js',
      env: {
        NODE_ENV: 'production',
        DASHBOARD_PORT: 10000
      },
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10
    },
    {
      name: 'yuvi-dashboard',
      script: 'dashboard.js',
      env: {
        NODE_ENV: 'production',
        DASHBOARD_PORT: 10000
      },
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10
    }
  ]
};
