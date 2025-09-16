import { Knex } from 'knex';
import * as pgvector from 'pgvector';
import { createHash } from 'crypto';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('embeddings').del();
  await knex('collections').del();

  // Create sample collections
  const [techDocsCollection] = await knex('collections')
    .insert({
      name: 'tech-documentation',
      description: 'Technical documentation and guides',
      metadata: { type: 'documentation', language: 'en' }
    })
    .returning('id');

  const [blogCollection] = await knex('collections')
    .insert({
      name: 'ai-blog-posts',
      description: 'AI and machine learning blog articles',
      metadata: { type: 'blog', category: 'ai' }
    })
    .returning('id');

  // Sample documents with their embeddings
  const sampleData = [
    {
      collection_id: techDocsCollection.id,
      content: 'PostgreSQL is a powerful, open source object-relational database system with over 35 years of active development. It has earned a strong reputation for reliability, feature robustness, and performance.',
      // Simulated embedding (in real app, this comes from OpenAI/Bedrock)
      embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
      metadata: {
        source: 'postgresql.org',
        category: 'database',
        tags: ['postgresql', 'database', 'sql'],
        word_count: 32,
        language: 'en'
      }
    },
    {
      collection_id: blogCollection.id,
      content: 'Vector databases enable semantic search by storing high-dimensional embeddings of text, images, and other data. Unlike traditional keyword search, vector search finds semantically similar content.',
      embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
      metadata: {
        source: 'tech-blog.com',
        category: 'ai',
        tags: ['vectors', 'embeddings', 'semantic-search'],
        author: 'Jane Smith',
        published_date: '2024-01-15',
        word_count: 28
      }
    },
    {
      collection_id: techDocsCollection.id,
      content: 'Knex.js is a SQL query builder for Node.js that supports PostgreSQL, MySQL, MariaDB, SQLite3, and Oracle. It features transaction support, connection pooling, and migrations.',
      embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
      metadata: {
        source: 'knexjs.org',
        category: 'javascript',
        tags: ['knex', 'nodejs', 'sql', 'query-builder'],
        framework: 'nodejs',
        word_count: 26
      }
    },
    {
      collection_id: blogCollection.id,
      content: 'RAG (Retrieval-Augmented Generation) combines the power of large language models with external knowledge bases. It retrieves relevant documents and uses them to generate more accurate responses.',
      embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
      metadata: {
        source: 'ai-research.com',
        category: 'ai',
        tags: ['rag', 'llm', 'retrieval', 'generation'],
        author: 'Dr. AI Researcher',
        published_date: '2024-02-01',
        word_count: 31,
        difficulty: 'intermediate'
      }
    },
    {
      collection_id: techDocsCollection.id,
      content: 'pgVector is a PostgreSQL extension that adds support for vector similarity search. It provides vector data types and indexes optimized for machine learning applications.',
      embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
      metadata: {
        source: 'github.com/pgvector',
        category: 'database',
        tags: ['pgvector', 'postgresql', 'vectors', 'ml'],
        word_count: 24,
        technical_level: 'advanced'
      }
    }
  ];

  // Insert sample embeddings with document hashes for deduplication
  for (const doc of sampleData) {
    const documentHash = createHash('sha256')
      .update(doc.content)
      .digest('hex');

    await knex('embeddings').insert({
      collection_id: doc.collection_id,
      document_hash: documentHash,
      content: doc.content,
      embedding: pgvector.toSql(doc.embedding),
      metadata: doc.metadata
    });
  }

  console.log('✅ Sample data seeded successfully!');
  console.log(`📊 Created ${sampleData.length} embeddings across 2 collections`);
}
