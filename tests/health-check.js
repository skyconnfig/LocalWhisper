#!/usr/bin/env node

// Simple health check script
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

const CONFIG = {
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  services: [
    { name: 'App', url: 'http://localhost:3000', path: '/api/health' },
    { name: 'PostgreSQL', url: 'postgresql://localhost:5432', port: 5432 },
    { name: 'Redis', url: 'redis://localhost:6379', port: 6379 },
    { name: 'MinIO', url: 'http://localhost:9000', path: '/minio/health/live' },
    { name: 'Ollama', url: 'http://localhost:11434', path: '/api/version' }
  ]
};

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkPort(port) {
  try {
    const { stdout } = await execAsync(`nc -z localhost ${port}`);
    return true;
  } catch (error) {
    return false;
  }
}

async function checkHTTP(url, path = '') {
  try {
    const response = await axios.get(url + path, { 
      timeout: 5000,
      validateStatus: () => true
    });
    return response.status < 500;
  } catch (error) {
    return false;
  }
}

async function checkServices() {
  console.log('🎙️ Whisper Local Deployment Health Check');
  console.log('==========================================\n');

  let healthyServices = 0;
  const totalServices = CONFIG.services.length;

  for (const service of CONFIG.services) {
    process.stdout.write(`Checking ${service.name}... `);
    
    let isHealthy = false;
    
    if (service.port) {
      isHealthy = await checkPort(service.port);
    } else if (service.path) {
      isHealthy = await checkHTTP(service.url, service.path);
    }
    
    if (isHealthy) {
      log(colors.green, '✓ HEALTHY');
      healthyServices++;
    } else {
      log(colors.red, '✗ UNHEALTHY');
    }
  }

  console.log(`\n📊 Health Summary: ${healthyServices}/${totalServices} services healthy`);
  
  if (healthyServices === totalServices) {
    log(colors.green, '🎉 All services are healthy! Ready for testing.');
    return true;
  } else if (healthyServices >= totalServices * 0.7) {
    log(colors.yellow, '⚠️  Most services are healthy. Some tests may fail.');
    return false;
  } else {
    log(colors.red, '❌ Many services are unhealthy. Tests will likely fail.');
    console.log('\n💡 To start services: docker-compose up -d');
    return false;
  }
}

if (require.main === module) {
  checkServices()
    .then(healthy => {
      process.exit(healthy ? 0 : 1);
    })
    .catch(error => {
      console.error('Health check failed:', error.message);
      process.exit(1);
    });
}

module.exports = { checkServices };