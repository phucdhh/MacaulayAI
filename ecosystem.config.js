module.exports = {
  apps: [
    {
      name: 'macaulay2web',
      cwd: '/Users/mac/Macaulay2',
      script: 'npm',
      args: 'start docker',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 5657
      },
      error_file: '/Users/mac/.pm2/logs/macaulay2web-error.log',
      out_file: '/Users/mac/.pm2/logs/macaulay2web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
