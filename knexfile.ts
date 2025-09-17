import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Point to the .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '.env') });

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'vectordb'}`,
    pool: { 
      min: 0, 
      max: 1,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 10000
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, './src/db/migrations'),
      disableTransactions: true
    },
    seeds: {
      directory: path.join(__dirname, './src/db/seeds')
    }
  },

  staging: {
    client: 'postgresql',
    connection: async () => {
      if (process.env.AWS_REGION) {
        const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
        
        try {
          const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
          const command = new GetSecretValueCommand({ SecretId: 'rag-api-db-staging' });
          const response = await client.send(command);
          const secret = JSON.parse(response.SecretString!);
          
          return {
            host: secret.host,
            port: secret.port,
            database: secret.dbname,
            user: secret.username,
            password: secret.password,
            ssl: { rejectUnauthorized: false }
          };
        } catch (error) {
          console.warn('Failed to get secrets from AWS Secrets Manager, falling back to env vars:', error);
        }
      }
      
      return {
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT!),
        database: process.env.DB_NAME!,
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        ssl: { rejectUnauthorized: false }
      };
    },
    pool: { 
      min: 0, 
      max: 2,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, './src/db/migrations'),
      disableTransactions: true
    },
    seeds: {
      directory: path.join(__dirname, './src/db/seeds')
    }
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT!),
      database: process.env.DB_NAME!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 20,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 60000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'seeds')
    }
  }
};

export default config;
