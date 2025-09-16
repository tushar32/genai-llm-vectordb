/**
 * @fileoverview Database connection and operations for PostgreSQL with pgVector
 * @module Database
 */

import knex, { Knex } from 'knex';
import * as pgvector from 'pgvector';
import { Embedding } from '../types/index';
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

/**
 * Database connection class for PostgreSQL with pgVector support (backward compatibility)
 */
class DatabaseConnection {
  private db: Knex;

  constructor() {
    this.db = db;
  }

  /**
   * Execute a raw SQL query
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.db.raw(text, params || []);
    return result.rows;
  }

  /**
   * Perform vector similarity search (backward compatibility)
   */
  async similaritySearch(
    embedding: number[],
    options: { tableName?: string; limit?: number; threshold?: number } = {}
  ): Promise<any[]> {
    const { tableName = 'langchain_pg_embedding', limit = 5, threshold = 0.0 } = options;

    const query = this.db(tableName)
      .select(
        'document',
        'cmetadata',
        'uuid',
        this.db.raw('1 - (embedding <=> ?) as similarity', [pgvector.toSql(embedding)])
      )
      .whereRaw('embedding <=> ? >= ?', [pgvector.toSql(embedding), threshold])
      .orderByRaw('embedding <=> ?', [pgvector.toSql(embedding)])
      .limit(limit);

    const result = await query;
    return result;
  }

  /**
   * Insert a document with its embedding into the database
   * 
   * @param document - Document text content
   * @param embedding - Document embedding vector
   * @param metadata - Document metadata
   * @param tableName - Target table name
   * @returns Promise resolving to inserted document UUID
   * 
   * @example
   * ```typescript
   * const uuid = await database.insertDocument(
   *   'This is a sample document',
   *   [0.1, 0.2, 0.3, ...],
   *   { source: 'sample.txt', page: 1 }
   * );
   * ```
   */
  async insertDocument(
    document: string,
    embedding: Embedding,
    metadata: Record<string, any> = {},
    tableName: string = 'langchain_pg_embedding'
  ): Promise<string> {
    const query = `
      INSERT INTO ${tableName} (document, embedding, cmetadata)
      VALUES ($1, $2::vector, $3)
      RETURNING uuid
    `;
    
    const embeddingString = `[${embedding.join(',')}]`;
    const result = await db.raw(
      query,
      [document, embeddingString, JSON.stringify(metadata)]
    );
    
    return result.rows[0]?.uuid || '';
  }

  /**
   * Get document count in a table
   * 
   * @param tableName - Table name to count documents in
   * @returns Promise resolving to document count
   */
  async getDocumentCount(tableName: string = 'langchain_pg_embedding'): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${tableName}`;
    const result = await db.raw(
      `SELECT COUNT(*) as count FROM ${tableName}`
    );
    
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Test database connection
   * 
   * @returns Promise resolving to true if connection is successful
   * 
   * @example
   * ```typescript
   * const isConnected = await database.testConnection();
   * if (isConnected) {
   *   console.log('Database connected successfully');
   * }
   * ```
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.db.destroy();
  }
}

// Export the Knex instance as default
export default db;
