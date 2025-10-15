#!/usr/bin/env node
/**
 * Cloud SQL Auto-Setup for LLM Framework
 * Automatically provisions and configures Cloud SQL instance via REST API
 * SECURITY ENHANCED: All sensitive data logging has been secured
 */

import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import crypto from 'crypto';

/**
 * Secure logging utility to prevent credential exposure
 * Fixes CodeQL Alert #15: Clear-text Logging of Sensitive Information
 */
class SecureLogger {
  static sensitivePatterns = [
    // Passwords and API keys
    /(password|passwd|pwd|secret|key|token|auth)\s*[:=]\s*['"]?([^'"\s,}]+)/gi,
    // Connection strings
    /(mysql|postgres|mongodb):\/\/[^:]+:([^@]+)@/gi,
    // Base64 encoded data that might contain credentials
    /['"]([A-Za-z0-9+/]{20,}={0,2})['"]/g,
    // Environment variables with sensitive names
    /(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=\s*['"]?([^'"\s,}]+)/gi,
    // IP addresses (moderate sensitivity)
    /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
  ];

  static redactSensitiveData(data: any): any {
    if (typeof data === 'string') {
      let sanitized = data;
      this.sensitivePatterns.forEach((pattern, index) => {
        if (index === 4) { // IP addresses - partial redaction
          sanitized = sanitized.replace(pattern, (match) => {
            const parts = match.split('.');
            return `${parts[0]}.${parts[1]}.xxx.xxx`;
          });
        } else {
          sanitized = sanitized.replace(pattern, (match, key, value) => {
            if (value) {
              const redacted = value.length > 4 ? 
                value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2) :
                '*'.repeat(value.length);
              return match.replace(value, redacted);
            }
            return match.replace(/[^\s:=]/g, '*');
          });
        }
      });
      return sanitized;
    } else if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this.redactSensitiveData(item));
      }
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        // Redact sensitive keys entirely
        if (/password|secret|key|token|auth|credential/i.test(key)) {
          sanitized[key] = '*'.repeat(8);
        } else {
          sanitized[key] = this.redactSensitiveData(value);
        }
      }
      return sanitized;
    }
    return data;
  }

  static secureLog(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const sanitizedMessage = this.redactSensitiveData(message);
    const sanitizedData = data ? this.redactSensitiveData(data) : null;
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message: sanitizedMessage,
      ...(sanitizedData && { data: sanitizedData })
    };

    console.log(JSON.stringify(logEntry, null, 2));
  }

  static info(message: string, data?: any): void {
    this.secureLog('info', message, data);
  }

  static error(message: string, data?: any): void {
    this.secureLog('error', message, data);
  }

  static warn(message: string, data?: any): void {
    this.secureLog('warn', message, data);
  }

  static debug(message: string, data?: any): void {
    if (process.env.DEBUG) {
      this.secureLog('debug', message, data);
    }
  }
}

class CloudSQLAutoProvisioner {
  constructor(projectId = 'scarmonit-8bcee') {
    this.projectId = projectId;
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/sqlservice.admin']
    });
    this.instanceId = `llm-optimized-${crypto.randomBytes(4).toString('hex')}`;
    this.dbName = 'optimization_db';
    this.username = 'llm_admin';
    this.password = crypto.randomBytes(12).toString('base64');
  }

  async getAccessToken() {
    try {
      const client = await this.auth.getClient();
      const token = await client.getAccessToken();
      SecureLogger.debug('Successfully obtained access token');
      return token.token;
    } catch (error) {
      SecureLogger.error('Failed to obtain access token', { error: error.message });
      throw error;
    }
  }

  async createInstance() {
    const token = await this.getAccessToken();
    
    const instanceConfig = {
      name: this.instanceId,
      databaseVersion: 'MYSQL_8_0',
      region: 'us-central1',
      settings: {
        tier: 'db-f1-micro', // Cost-optimized
        dataDiskType: 'PD_SSD',
        dataDiskSizeGb: '10',
        pricingPlan: 'PER_USE',
        storageAutoResize: true,
        storageAutoResizeLimit: '100',
        backupConfiguration: {
          enabled: true,
          binaryLogEnabled: false,
          pointInTimeRecoveryEnabled: false,
          startTime: '02:00'
        },
        ipConfiguration: {
          ipv4Enabled: true,
          authorizedNetworks: [{
            name: 'allow-all',
            value: '0.0.0.0/0'
          }]
        },
        databaseFlags: [
          { name: 'max_connections', value: '50' },
          { name: 'innodb_buffer_pool_size', value: '134217728' } // 128MB
        ]
      }
    };

    try {
      const response = await fetch(`https://sqladmin.googleapis.com/v1/projects/${this.projectId}/instances`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(instanceConfig)
      });

      if (!response.ok) {
        const error = await response.text();
        SecureLogger.error(`Instance creation failed: ${response.status}`, { status: response.status });
        throw new Error(`Instance creation failed: ${response.status} - Error details redacted for security`);
      }

      const result = await response.json();
      SecureLogger.info(`Instance creation initiated successfully`, { instanceId: this.instanceId });
      SecureLogger.debug('Operation details', { operationName: result.name });
      
      return result;
    } catch (error) {
      SecureLogger.error('Failed to create instance', { error: error.message, instanceId: this.instanceId });
      throw error;
    }
  }

  async waitForOperation(operationName, maxWaitMinutes = 10) {
    const token = await this.getAccessToken();
    const startTime = Date.now();
    const timeoutMs = maxWaitMinutes * 60 * 1000;

    SecureLogger.info('Waiting for operation to complete', { 
      operationName: operationName.split('/').pop(), 
      maxWaitMinutes 
    });

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`https://sqladmin.googleapis.com/v1/projects/${this.projectId}/operations/${operationName}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const operation = await response.json();
        
        if (operation.status === 'DONE') {
          if (operation.error) {
            SecureLogger.error('Operation failed', { operationName: operationName.split('/').pop() });
            throw new Error(`Operation failed - details redacted for security`);
          }
          SecureLogger.info('Operation completed successfully', { operationName: operationName.split('/').pop() });
          return operation;
        }

        SecureLogger.debug('Operation in progress', { status: operation.status });
        await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15s
      } catch (error) {
        SecureLogger.error('Error checking operation status', { error: error.message });
        throw error;
      }
    }

    SecureLogger.error('Operation timeout', { maxWaitMinutes });
    throw new Error(`Operation timeout after ${maxWaitMinutes} minutes`);
  }

  async createDatabase() {
    const token = await this.getAccessToken();
    
    const dbConfig = {
      name: this.dbName,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci'
    };

    try {
      const response = await fetch(`https://sqladmin.googleapis.com/v1/projects/${this.projectId}/instances/${this.instanceId}/databases`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dbConfig)
      });

      if (!response.ok) {
        const error = await response.text();
        SecureLogger.error(`Database creation failed: ${response.status}`, { dbName: this.dbName });
        throw new Error(`Database creation failed: ${response.status} - Error details redacted for security`);
      }

      const result = await response.json();
      SecureLogger.info('Database created successfully', { dbName: this.dbName });
      return result;
    } catch (error) {
      SecureLogger.error('Failed to create database', { error: error.message, dbName: this.dbName });
      throw error;
    }
  }

  async createUser() {
    const token = await this.getAccessToken();
    
    const userConfig = {
      name: this.username,
      password: this.password,
      host: '%' // Allow from any host
    };

    try {
      const response = await fetch(`https://sqladmin.googleapis.com/v1/projects/${this.projectId}/instances/${this.instanceId}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userConfig)
      });

      if (!response.ok) {
        const error = await response.text();
        SecureLogger.error(`User creation failed: ${response.status}`, { username: this.username });
        throw new Error(`User creation failed: ${response.status} - Error details redacted for security`);
      }

      const result = await response.json();
      SecureLogger.info('Database user created successfully', { username: this.username });
      return result;
    } catch (error) {
      SecureLogger.error('Failed to create user', { error: error.message, username: this.username });
      throw error;
    }
  }

  async getInstanceDetails() {
    const token = await this.getAccessToken();
    
    try {
      const response = await fetch(`https://sqladmin.googleapis.com/v1/projects/${this.projectId}/instances/${this.instanceId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.text();
        SecureLogger.error(`Failed to get instance details: ${response.status}`);
        throw new Error(`Failed to get instance details: ${response.status} - Error details redacted for security`);
      }

      const instance = await response.json();
      return instance;
    } catch (error) {
      SecureLogger.error('Failed to retrieve instance details', { error: error.message });
      throw error;
    }
  }

  async provision() {
    try {
      SecureLogger.info('Starting Cloud SQL provisioning', { projectId: this.projectId });
      
      // Create instance
      const createOp = await this.createInstance();
      const operationId = createOp.name.split('/').pop();
      
      // Wait for instance creation
      await this.waitForOperation(operationId);
      
      // Get instance details
      const instance = await this.getInstanceDetails();
      const ipAddress = instance.ipAddresses.find(ip => ip.type === 'PRIMARY').ipAddress;
      
      SecureLogger.info('Instance provisioned with IP address', { 
        instanceId: this.instanceId,
        ipAddress: SecureLogger.redactSensitiveData(ipAddress)
      });
      
      // Create database
      await this.createDatabase();
      
      // Create user
      await this.createUser();
      
      // Generate connection config (with secure logging)
      const config = {
        instanceId: this.instanceId,
        ipAddress,
        database: this.dbName,
        username: this.username,
        password: this.password, // This will be redacted in logs
        connectionString: `mysql://${this.username}:${this.password}@${ipAddress}:3306/${this.dbName}`,
        environmentVariables: {
          CLOUD_SQL_HOST: ipAddress,
          CLOUD_SQL_PORT: '3306',
          CLOUD_SQL_USER: this.username,
          CLOUD_SQL_PASSWORD: this.password,
          CLOUD_SQL_DATABASE: this.dbName
        }
      };
      
      // SECURITY FIX: Use secure logging that redacts sensitive data
      SecureLogger.info('Connection configuration generated', {
        instanceId: config.instanceId,
        database: config.database,
        username: config.username,
        hasPassword: !!config.password,
        hasConnectionString: !!config.connectionString
      });
      
      // Save to env file
      const envContent = Object.entries(config.environmentVariables)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      const fs = await import('fs/promises');
      await fs.writeFile('.env.cloudsql', envContent);
      SecureLogger.info('Configuration saved to environment file', { filename: '.env.cloudsql' });
      
      return config;
      
    } catch (error) {
      SecureLogger.error('Cloud SQL provisioning failed', { error: error.message });
      throw error;
    }
  }

  async cleanup() {
    try {
      const token = await this.getAccessToken();
      
      const response = await fetch(`https://sqladmin.googleapis.com/v1/projects/${this.projectId}/instances/${this.instanceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.text();
        SecureLogger.error(`Cleanup failed: ${response.status}`);
        throw new Error(`Cleanup failed: ${response.status} - Error details redacted for security`);
      }

      SecureLogger.info('Instance deletion initiated', { instanceId: this.instanceId });
      const result = await response.json();
      return result;
    } catch (error) {
      SecureLogger.error('Cleanup operation failed', { error: error.message });
      throw error;
    }
  }
}

// CLI execution with secure logging
if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2] || 'provision';
  const provisioner = new CloudSQLAutoProvisioner();
  
  if (action === 'provision') {
    provisioner.provision()
      .then(config => {
        SecureLogger.info('Cloud SQL provisioning completed successfully');
        console.log('\n🔗 Next steps:');
        console.log('1. Source the environment: source .env.cloudsql');
        console.log('2. Run the setup script: node scripts/cloud-sql-setup.js');
        console.log('3. Test connection with your LLM optimization scripts');
      })
      .catch(error => {
        SecureLogger.error('Provisioning operation failed', { error: error.message });
        process.exit(1);
      });
  } else if (action === 'cleanup') {
    console.log('⚠️  This will delete the Cloud SQL instance. Continue? (y/N)');
    process.stdin.on('data', async (data) => {
      if (data.toString().trim().toLowerCase() === 'y') {
        try {
          await provisioner.cleanup();
          SecureLogger.info('Cleanup completed successfully');
        } catch (error) {
          SecureLogger.error('Cleanup operation failed', { error: error.message });
        }
        process.exit(0);
      } else {
        SecureLogger.info('Cleanup operation cancelled');
        process.exit(0);
      }
    });
  } else {
    console.log('Usage: node cloud-sql-auto-provisioner.js [provision|cleanup]');
    process.exit(1);
  }
}

export default CloudSQLAutoProvisioner;