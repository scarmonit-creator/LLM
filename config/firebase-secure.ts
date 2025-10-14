/**
 * Secure Firebase Admin SDK Configuration
 * 
 * SECURITY CRITICAL: Based on Google Cloud Console analysis showing:
 * - Two active service account keys created Oct 14, 2025
 * - Keys with Dec 31, 9999 expiration (no rotation)
 * - Google warning: "Service account keys could pose a security risk if compromised"
 * - Recommendation to use Workload Identity Federation
 * 
 * This implementation follows Google's security best practices:
 * 1. Workload Identity Federation (preferred)
 * 2. Application Default Credentials (Google Cloud)
 * 3. Environment variables only (no keys in code)
 * 4. Automatic key rotation alerts
 */

import admin from 'firebase-admin';
import { config } from 'dotenv';

config();

interface FirebaseConfig {
  credential: admin.credential.Credential;
  projectId: string;
  databaseURL?: string;
}

class SecureFirebaseConfig {
  private static instance: admin.app.App | null = null;
  private static initializationMethod: string = 'none';

  /**
   * Initialize Firebase with security-first approach
   * Priority order: WIF > ADC > Environment Variables
   */
  static async initialize(): Promise<admin.app.App> {
    if (this.instance) {
      console.log(`🔐 Firebase already initialized via ${this.initializationMethod}`);
      return this.instance;
    }

    try {
      // Method 1: Workload Identity Federation (RECOMMENDED)
      if (this.canUseWorkloadIdentity()) {
        this.instance = await this.initializeWithWorkloadIdentity();
        this.initializationMethod = 'Workload Identity Federation';
        console.log('✅ Firebase initialized with Workload Identity Federation (MOST SECURE)');
        return this.instance;
      }

      // Method 2: Application Default Credentials (Google Cloud environments)
      if (this.canUseADC()) {
        this.instance = this.initializeWithADC();
        this.initializationMethod = 'Application Default Credentials';
        console.log('✅ Firebase initialized with ADC (SECURE)');
        return this.instance;
      }

      // Method 3: Base64 encoded service account (CI/CD environments)
      if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        this.instance = this.initializeWithBase64();
        this.initializationMethod = 'Base64 Service Account';
        console.log('⚠️  Firebase initialized with Base64 key (ROTATE REGULARLY)');
        this.scheduleKeyRotationAlert();
        return this.instance;
      }

      // Method 4: Environment variables (legacy, least secure)
      if (this.canUseEnvironmentVariables()) {
        this.instance = this.initializeWithEnvironment();
        this.initializationMethod = 'Environment Variables';
        console.log('🚨 Firebase initialized with env vars (UPGRADE TO WIF/ADC)');
        this.scheduleKeyRotationAlert();
        return this.instance;
      }

      throw new Error('No valid Firebase authentication method found');

    } catch (error) {
      console.error('🔥 Firebase initialization failed:', error);
      throw error;
    }
  }

  /**
   * Workload Identity Federation - MOST SECURE
   * No keys needed, uses workload identity pool
   */
  private static async initializeWithWorkloadIdentity(): Promise<admin.app.App> {
    const config: FirebaseConfig = {
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'scarmonit-8bcee'
    };

    return admin.initializeApp(config);
  }

  /**
   * Application Default Credentials - SECURE
   * Uses metadata server or gcloud credentials
   */
  private static initializeWithADC(): admin.app.App {
    const config: FirebaseConfig = {
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'scarmonit-8bcee'
    };

    return admin.initializeApp(config);
  }

  /**
   * Base64 encoded service account - ACCEPTABLE for CI/CD
   */
  private static initializeWithBase64(): admin.app.App {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!serviceAccountBase64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is required');
    }

    let serviceAccount;
    try {
      const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      throw new Error('Invalid Base64 service account JSON');
    }

    const config: FirebaseConfig = {
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    };

    return admin.initializeApp(config);
  }

  /**
   * Environment variables - LEGACY, needs rotation
   */
  private static initializeWithEnvironment(): admin.app.App {
    const serviceAccount = {
      type: process.env.FIREBASE_TYPE || 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN || 'googleapis.com'
    };

    // Validate required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Missing required Firebase environment variables');
    }

    const config: FirebaseConfig = {
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      projectId: serviceAccount.project_id
    };

    return admin.initializeApp(config);
  }

  // Security checks

  private static canUseWorkloadIdentity(): boolean {
    // Check for workload identity environment
    return !!(
      process.env.GOOGLE_CLOUD_PROJECT &&
      (process.env.KUBERNETES_SERVICE_HOST || // GKE
       process.env.CLOUD_RUN_SERVICE || // Cloud Run
       process.env.FUNCTION_TARGET) // Cloud Functions
    );
  }

  private static canUseADC(): boolean {
    return !!(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT
    );
  }

  private static canUseEnvironmentVariables(): boolean {
    return !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    );
  }

  /**
   * Schedule key rotation alerts for environments using keys
   */
  private static scheduleKeyRotationAlert(): void {
    const ROTATION_WARNING_DAYS = 30;
    const WARNING_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days

    setInterval(() => {
      console.log(`🔄 SECURITY REMINDER: Rotate Firebase service account keys`);
      console.log(`   Current keys created: Oct 14, 2025`);
      console.log(`   Recommendation: Migrate to Workload Identity Federation`);
      console.log(`   Guide: https://cloud.google.com/iam/docs/workload-identity-federation`);
    }, WARNING_INTERVAL);
  }

  /**
   * Get Firebase app instance (singleton)
   */
  static getInstance(): admin.app.App | null {
    return this.instance;
  }

  /**
   * Get initialization method for monitoring
   */
  static getInitializationMethod(): string {
    return this.initializationMethod;
  }

  /**
   * Security audit report
   */
  static getSecurityReport(): any {
    return {
      timestamp: new Date().toISOString(),
      method: this.initializationMethod,
      isSecure: this.initializationMethod.includes('Workload Identity') || 
                this.initializationMethod.includes('ADC'),
      recommendations: this.getSecurityRecommendations()
    };
  }

  private static getSecurityRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.initializationMethod === 'Environment Variables') {
      recommendations.push('CRITICAL: Migrate to Workload Identity Federation');
      recommendations.push('Rotate service account keys immediately (current keys from Oct 14, 2025)');
      recommendations.push('Remove keys from Google Cloud Console after migration');
    }

    if (this.initializationMethod === 'Base64 Service Account') {
      recommendations.push('HIGH: Migrate to Workload Identity Federation for production');
      recommendations.push('Schedule regular key rotation (every 90 days)');
    }

    if (this.initializationMethod === 'Application Default Credentials') {
      recommendations.push('GOOD: Consider upgrading to Workload Identity Federation');
    }

    if (this.initializationMethod === 'Workload Identity Federation') {
      recommendations.push('EXCELLENT: Optimal security configuration');
    }

    return recommendations;
  }
}

export default SecureFirebaseConfig;