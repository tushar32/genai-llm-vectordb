import type { Knex } from 'knex';
import * as dotenv from 'dotenv';

dotenv.config();

// Get the current environment, fallback to development if not specified
const environment = process.env.NODE_ENV || 'development';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'vectordb_test'}`,
    pool: { 
      min: 0, 
      max: 1,
      acquireTimeoutMillis: 10000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 10000
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations',
      disableTransactions: true
    },
    seeds: {
      directory: './seeds'
    }
  },

  staging: {
    client: 'postgresql',
    connection: (async () => {
      const { Signer } = require('@aws-sdk/rds-signer');
      
      if (process.env.DB_IAM_AUTH === 'true') {
        const signer = new Signer({
          hostname: process.env.DB_HOST!,
          port: parseInt(process.env.DB_PORT!),
          username: process.env.DB_USER!,
          region: process.env.AWS_REGION || 'us-east-1',
        });
        
        const password = await signer.getAuthToken();
        return {
          host: process.env.DB_HOST!,
          port: parseInt(process.env.DB_PORT!),
          database: process.env.DB_NAME!,
          user: process.env.DB_USER!,
          password,
          ssl: { rejectUnauthorized: false }
        };
      } else {
        return `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
      }
    }) as any,
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
      directory: './migrations',
      disableTransactions: true
    },
    seeds: {
      directory: './seeds'
    }
  },

  production: {
    client: 'postgresql',
    connection: (async () => {
      const { Signer } = require('@aws-sdk/rds-signer');
      
      if (process.env.DB_IAM_AUTH === 'true') {
        const signer = new Signer({
          hostname: process.env.DB_HOST!,
          port: parseInt(process.env.DB_PORT!),
          username: process.env.DB_USER!,
          region: process.env.AWS_REGION || 'us-east-1',
        });
        
        const password = await signer.getAuthToken();
        return {
          host: process.env.DB_HOST!,
          port: parseInt(process.env.DB_PORT!),
          database: process.env.DB_NAME!,
          user: process.env.DB_USER!,
          password,
          ssl: { rejectUnauthorized: false }
        };
      } else {
        return {
          host: process.env.DB_HOST!,
          port: parseInt(process.env.DB_PORT!),
          database: process.env.DB_NAME!,
          user: process.env.DB_USER!,
          password: process.env.DB_PASSWORD!,
          ssl: false
        };
      }
    }) as any,
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
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  }
};

export default config;
