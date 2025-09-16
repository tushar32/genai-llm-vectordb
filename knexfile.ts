import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'vectordb',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },

  staging: {
    client: 'postgresql',
    connection: async () => {
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
          password: password,
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
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    },
    acquireConnectionTimeout: 60000
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'vectordb',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    },
    acquireConnectionTimeout: 60000
  }
};

export default config;
