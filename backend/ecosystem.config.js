module.exports = {
  apps: [
    {
      name: "triplens-backend",
      script: "./dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      max_memory_restart: "500M",
      watch: false,
      ignore_watch: [
        "node_modules",
        "dist",
        "uploads",
        "logs",
        ".git",
        ".env",
      ],
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
