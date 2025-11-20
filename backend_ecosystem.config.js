module.exports = {
  apps: [
    {
      name: "memegrave-backend",
      cwd: "./",                 // when placed in backend/, PM2 cwd = backend/
      script: "index.js",
      args: "",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "development"
      },
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};