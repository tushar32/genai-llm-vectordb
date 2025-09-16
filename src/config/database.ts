/**
 * @fileoverview Database connection and operations for PostgreSQL with pgVector
 * @module Database
 */

import knex from 'knex';
import * as pgvector from 'pgvector';
import { Signer } from '@aws-sdk/rds-signer';

// Function to get database credentials, using IAM auth for staging/prod
const getDbCredentials = async () => {
  const isIamAuth = process.env.DB_IAM_AUTH === 'true';
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432');
  const user = process.env.DB_USER || 'postgres';
  const database = process.env.DB_NAME || 'vectordb';

  if (isIamAuth) {
    const signer = new Signer({ 
        hostname: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT!),
        username: process.env.DB_USER!,
        region: process.env.AWS_REGION!,
     });

    const password = await signer.getAuthToken();
    return {
      host, port, user, database, password,
      ssl: { rejectUnauthorized: false } // SSL is required for IAM auth
    };
  } else {
    // Local development credentials
    return {
      host, port, user, database,
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: false
    };
  }
};

// Initialize Knex instance using an async factory
const db = knex({
  client: 'pg',
  connection: async () => await getDbCredentials(),
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'knex_migrations'
  }
});

export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
}

export interface EmbeddingRecord {
  id?: string;
  collection_id: string;
  document_hash: string;
  content: string;
  embedding: number[];
  metadata?: any;
}

/**
 * High-performance vector similarity search using pgVector
 */
export async function searchSimilarEmbeddings(
  queryEmbedding: number[],
  collectionId?: string,
  limit: number = 5,
  threshold: number = 0.8
): Promise<VectorSearchResult[]> {
  let query = db('embeddings')
    .select(
      'id',
      'content',
      'metadata',
      db.raw('1 - (embedding <=> ?) as similarity', [pgvector.toSql(queryEmbedding)])
    )
    .whereRaw('embedding <=> ? < ?', [pgvector.toSql(queryEmbedding), threshold])
    .orderByRaw('embedding <=> ?', [pgvector.toSql(queryEmbedding)])
    .limit(limit);

  if (collectionId) {
    query = query.where('collection_id', collectionId);
  }

  return await query;
}

/**
 * Insert embedding with deduplication
 */
export async function insertEmbedding(record: EmbeddingRecord): Promise<string> {
  const [result] = await db('embeddings')
    .insert({
      ...record,
      embedding: pgvector.toSql(record.embedding)
    })
    .onConflict(['collection_id', 'document_hash'])
    .merge(['content', 'embedding', 'metadata'])
    .returning('id');
  
  return result.id;
}

/**
 * Batch insert embeddings for better performance
 */
export async function batchInsertEmbeddings(records: EmbeddingRecord[]): Promise<void> {
  const batchSize = 100;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize).map(record => ({
      ...record,
      embedding: pgvector.toSql(record.embedding)
    }));
    
    await db('embeddings')
      .insert(batch)
      .onConflict(['collection_id', 'document_hash'])
      .merge(['content', 'embedding', 'metadata']);
  }
}

/**
 * Create or get collection
 */
export async function getOrCreateCollection(name: string, description?: string): Promise<string> {
  const existing = await db('collections').where('name', name).first();
  
  if (existing) {
    return existing.id;
  }
  
  const [result] = await db('collections')
    .insert({ name, description })
    .returning('id');
    
  return result.id;
}

/**
 * Log query for analytics
 */
export async function logQuery(
  queryText: string,
  queryEmbedding: number[],
  resultsCount: number,
  responseTimeMs: number,
  provider: string,
  userId?: string,
  collectionId?: string
): Promise<void> {
  await db('query_logs').insert({
    user_id: userId,
    collection_id: collectionId,
    query_text: queryText,
    query_embedding: pgvector.toSql(queryEmbedding),
    results_count: resultsCount,
    response_time_ms: responseTimeMs,
    provider
  });
}

// DatabaseConnection class removed - using Knex directly for better performance

// Export the Knex instance as default
export default db;
