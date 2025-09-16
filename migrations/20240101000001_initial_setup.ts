import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable required extensions
  await knex.raw('CREATE EXTENSION IF NOT EXISTS vector');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create collections table
  await knex.schema.createTable('collections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 255).notNullable().unique();
    table.text('description');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create embeddings table with vector column
  await knex.schema.createTable('embeddings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('collection_id').notNullable()
      .references('id').inTable('collections').onDelete('CASCADE');
    table.string('document_hash', 64).notNullable(); // SHA-256 for deduplication
    table.text('content').notNullable();
    table.specificType('embedding', 'vector(1536)').notNullable();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    
    // Unique constraint for deduplication
    table.unique(['collection_id', 'document_hash']);
  });

  // Create optimized indexes for vector search
  await knex.raw(`
    CREATE INDEX CONCURRENTLY embeddings_vector_cosine_idx 
    ON embeddings USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100)
  `);

  // Additional performance indexes
  await knex.schema.alterTable('embeddings', (table) => {
    table.index('collection_id');
    table.index('created_at');
  });

  await knex.raw('CREATE INDEX embeddings_metadata_gin_idx ON embeddings USING gin(metadata)');

  // Create users table for API key management
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('email', 255).notNullable().unique();
    table.string('api_key', 255).notNullable().unique();
    table.integer('rate_limit_per_hour').defaultTo(1000);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create query logs for analytics
  await knex.schema.createTable('query_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('collection_id').references('id').inTable('collections').onDelete('SET NULL');
    table.text('query_text').notNullable();
    table.specificType('query_embedding', 'vector(1536)');
    table.integer('results_count');
    table.integer('response_time_ms');
    table.string('provider', 50);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Indexes for query logs
  await knex.schema.alterTable('query_logs', (table) => {
    table.index('created_at');
    table.index('user_id');
  });

  // Create backward compatibility table (matches existing schema)
  await knex.schema.createTable('langchain_pg_embedding', (table) => {
    table.uuid('uuid').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.text('document').notNullable();
    table.specificType('embedding', 'vector(1536)').notNullable();
    table.jsonb('cmetadata').defaultTo('{}');
  });

  // Index for backward compatibility
  await knex.raw(`
    CREATE INDEX CONCURRENTLY langchain_pg_embedding_vector_cosine_idx 
    ON langchain_pg_embedding USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('langchain_pg_embedding');
  await knex.schema.dropTableIfExists('query_logs');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('embeddings');
  await knex.schema.dropTableIfExists('collections');
  
  await knex.raw('DROP EXTENSION IF EXISTS vector');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}
