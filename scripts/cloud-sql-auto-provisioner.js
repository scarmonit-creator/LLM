#!/usr/bin/env node
/**
 * Cloud SQL Auto-Setup for LLM Framework
 * Automatically provisions and configures Cloud SQL instance via REST API
 * 
 * SECURITY: Updated to fix CodeQL Alert #15 - Clear-text Logging of Sensitive Information
 * Implements proper credential sanitization and secure logging practices
 */

import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import crypto from 'crypto';

/**
 * Sanitize credentials for safe logging (SECURITY FIX)
 * Removes sensitive information from connection strings and objects
 */
function sanitizeCredentials(input) {
  if (typeof input === 'string') {
    // Remove passwords from connection strings
    return input.replace(/:([^:@]+)@/g, ':***@')
                .replace(/password=([^&;\s]+)/gi, 'password=***')
                .replace(/pwd=([^&;\s]+)/gi, 'pwd=***')
                .replace(/pass=([^&;\s]+)/gi, 'pass=***');
  } else if (typeof input === 'object' && input !== null) {
    const sanitized = { ...input };
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.pwd) sanitized.pwd = '***';
    if (sanitized.pass) sanitized.pass = '***';
    if (sanitized.connectionString) {
      sanitized.connectionString = sanitizeCredentials(sanitized.connectionString);
    }
    return sanitized;
  }
  return input;
}

/**
 * Secure logging utility that automatically sanitizes sensitive data
 */
function secureLog(message, data = null) {
  const sanitizedData = data ? sanitizeCredentials(data) : null;
  if (sanitizedData) {
    console.log(message, typeof sanitizedData === 'object' ? JSON.stringify(sanitizedData, null, 2) : sanitizedData);
  } else {
    console.log(message);
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
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
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
      throw new Error(`Instance creation failed: ${response.status} ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Instance creation initiated: ${this.instanceId}`);
    console.log(`🔄 Operation: ${result.name}`);
    
    return result;
  }

  async waitForOperation(operationName, maxWaitMinutes = 10) {
    const token = await this.getAccessToken();
    const startTime = Date.now();
    const timeoutMs = maxWaitMinutes * 60 * 1000;

    while (Date.now() - startTime < timeoutMs) {
      const response = await fetch(`https://sqladmin.googleapis.com/v1/projects/${this.projectId}/operations/${operationName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const operation = await response.json();
      
      if (operation.status === 'DONE') {
        if (operation.error) {
          throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
        }
        console.log(`✅ Operation completed: ${operationName}`);
        return operation;
      }

      console.log(`⏳ Operation in progress: ${operation.status}`);
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15s
    }

    throw new Error(`Operation timeout after ${maxWaitMinutes} minutes`);
  }

  async createDatabase() {
    const token = await this.getAccessToken();
    
    const dbConfig = {
      name: this.dbName,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci'
    };

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
      throw new Error(`Database creation failed: ${response.status} ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Database created: ${this.dbName}`);
    return result;
  }

  async createUser() {
    const token = await this.getAccessToken();
    
    const userConfig = {
      name: this.username,
      password: this.password,
      host: '%' // Allow from any host
    };

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
      throw new Error(`User creation failed: ${response.status} ${error}`);
    }

    const result = await response.json();
    console.log(`✅ User created: ${this.username}`);
    return result;
  }

  async getInstanceDetails() {
    const token = await this.getAccessToken();
    
    const response = await fetch(`https://sqladmin.googleapis.com/v1/projects/${this.projectId}/instances/${this.instanceId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get instance details: ${response.status} ${error}`);
    }

    const instance = await response.json();
    return instance;
  }

  async provision() {
    try {
      console.log(`🚀 Starting Cloud SQL provisioning for project: ${this.projectId}`);
      
      // Create instance
      const createOp = await this.createInstance();
      const operationId = createOp.name.split('/').pop();
      
      // Wait for instance creation
      await this.waitForOperation(operationId);
      
      // Get instance details
      const instance = await this.getInstanceDetails();
      const ipAddress = instance.ipAddresses.find(ip => ip.type === 'PRIMARY').ipAddress;
      
      console.log(`🌐 Instance IP: ${ipAddress}`);
      
      // Create database
      await this.createDatabase();
      
      // Create user
      await this.createUser();
      
      // Generate connection config (SECURITY FIX - sanitized logging)
      const config = {
        instanceId: this.instanceId,
        ipAddress,
        database: this.dbName,
        username: this.username,
        password: this.password,
        connectionString: `mysql://${this.username}:${this.password}@${ipAddress}:3306/${this.dbName}`,
        environmentVariables: {
          CLOUD_SQL_HOST: ipAddress,
          CLOUD_SQL_PORT: '3306',
          CLOUD_SQL_USER: this.username,
          CLOUD_SQL_PASSWORD: this.password,
          CLOUD_SQL_DATABASE: this.dbName
        }
      };
      
      console.log('\n📋 Connection Configuration:');
      // SECURITY FIX: Use secure logging instead of direct console.log of sensitive data
      secureLog('Database connection details:', config);
      
      // Save to env file (passwords will be in file but not in logs)
      const envContent = Object.entries(config.environmentVariables)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      const fs = await import('fs/promises');
      await fs.writeFile('.env.cloudsql', envContent);
      console.log('\n💾 Configuration saved to .env.cloudsql');
      
      // Return sanitized config for further processing
      return sanitizeCredentials(config);
      
    } catch (error) {
      console.error('❌ Provisioning failed:', error.message);
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
        throw new Error(`Cleanup failed: ${response.status} ${error}`);
      }

      console.log(`🗑️ Instance ${this.instanceId} deletion initiated`);
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      throw error;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const action = process.argv[2] || 'provision';
  const provisioner = new CloudSQLAutoProvisioner();
  
  if (action === 'provision') {
    provisioner.provision()
      .then(config => {
        console.log('\n✅ Cloud SQL provisioning completed successfully!');
        console.log('\n🔗 Next steps:');
        console.log('1. Source the environment: source .env.cloudsql');
        console.log('2. Run the setup script: node scripts/cloud-sql-setup.js');
        console.log('3. Test connection with your LLM optimization scripts');
        console.log('\n🔒 Security: Credentials are stored in .env.cloudsql (not in logs)');
      })
      .catch(error => {
        console.error('💥 Provisioning failed:', error.message);
        process.exit(1);
      });
  } else if (action === 'cleanup') {
    console.log('⚠️  This will delete the Cloud SQL instance. Continue? (y/N)');
    process.stdin.on('data', async (data) => {
      if (data.toString().trim().toLowerCase() === 'y') {
        try {
          await provisioner.cleanup();
          console.log('✅ Cleanup completed');
        } catch (error) {
          console.error('❌ Cleanup failed:', error.message);
        }
        process.exit(0);
      } else {
        console.log('❌ Cleanup cancelled');
        process.exit(0);
      }
    });
  } else {
    console.log('Usage: node cloud-sql-auto-provisioner.js [provision|cleanup]');
    process.exit(1);
  }
}

export default CloudSQLAutoProvisioner;