module.exports = {
  apps: [{
    name: 'MoneyMaker',
    script: 'backend/server.js',
    cwd: '/home/webserver/projects/MoneyMachine',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_file: 'logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    kill_timeout: 5000
  }]
};

