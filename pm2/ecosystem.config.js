module.exports = {
  apps: [
    {
      name: "memegrave-backend",
      script: "./index.js",
      cwd: "/opt/memegrave/backend",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};