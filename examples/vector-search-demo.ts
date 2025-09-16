import { searchSimilarEmbeddings, insertEmbedding, getOrCreateCollection } from '../src/config/database';
import embeddingService from '../src/services/embeddingService';

/**
 * Demo: How vector search finds semantically similar content
 */
async function vectorSearchDemo() {
  console.log('🔍 Vector Search Demo\n');

  // 1. User asks a question
  const userQuestion = "How do I optimize database performance?";
  console.log(`❓ User Question: "${userQuestion}"`);

  // 2. Convert question to vector embedding
  const questionEmbedding = await embeddingService.generateEmbedding(userQuestion, 'openai');
  console.log(`🔢 Question Embedding: [${questionEmbedding.slice(0, 5).join(', ')}...] (1536 dimensions)`);

  // 3. Search for similar documents in vector space
  const similarDocs = await searchSimilarEmbeddings(
    questionEmbedding,
    undefined, // search all collections
    5,         // top 5 results
    0.7        // similarity threshold
  );

  console.log('\n📊 Similar Documents Found:');
  similarDocs.forEach((doc, index) => {
    console.log(`\n${index + 1}. Similarity: ${(doc.similarity * 100).toFixed(1)}%`);
    console.log(`   Content: "${doc.content.substring(0, 100)}..."`);
    console.log(`   Metadata:`, doc.metadata);
  });

  // 4. Use retrieved context to generate response
  const context = similarDocs.map(doc => doc.content).join('\n\n');
  console.log('\n📝 Context for LLM:');
  console.log(`"${context.substring(0, 200)}..."`);

  return similarDocs;
}

/**
 * Demo: Adding new documents to the vector database
 */
async function addDocumentDemo() {
  console.log('\n📝 Adding New Document Demo\n');

  // Create or get collection
  const collectionId = await getOrCreateCollection(
    'performance-tips',
    'Database performance optimization guides'
  );

  // New document to add
  const newDocument = {
    content: `To optimize PostgreSQL performance: 1) Create proper indexes on frequently queried columns, 
    2) Use EXPLAIN ANALYZE to identify slow queries, 3) Configure shared_buffers and work_mem appropriately, 
    4) Regular VACUUM and ANALYZE operations, 5) Consider partitioning for large tables.`,
    metadata: {
      source: 'dba-handbook.com',
      category: 'performance',
      tags: ['postgresql', 'optimization', 'indexing', 'tuning'],
      difficulty: 'intermediate',
      word_count: 45
    }
  };

  // Generate embedding for the document
  const embedding = await embeddingService.generateEmbedding(newDocument.content, 'openai');
  
  // Create document hash for deduplication
  const crypto = require('crypto');
  const documentHash = crypto.createHash('sha256').update(newDocument.content).digest('hex');

  // Insert into database
  const documentId = await insertEmbedding({
    collection_id: collectionId,
    document_hash: documentHash,
    content: newDocument.content,
    embedding: embedding,
    metadata: newDocument.metadata
  });

  console.log(`✅ Document added with ID: ${documentId}`);
  console.log(`📊 Embedding dimensions: ${embedding.length}`);
  console.log(`🔗 Collection: ${collectionId}`);
  console.log(`#️⃣  Document hash: ${documentHash.substring(0, 16)}...`);

  return documentId;
}

/**
 * Demo: Real-world use cases
 */
async function useCaseExamples() {
  console.log('\n🌟 Real-World Use Cases:\n');

  const useCases = [
    {
      type: 'Customer Support',
      documents: [
        'How to reset your password: Go to login page, click "Forgot Password"...',
        'Billing questions: Your invoice is generated monthly on the 1st...',
        'Technical issues: Try clearing browser cache and cookies first...'
      ],
      query: 'I forgot my login credentials',
      expectedMatch: 'password reset'
    },
    {
      type: 'Code Documentation',
      documents: [
        'React useEffect hook: Performs side effects in function components...',
        'Express middleware: Functions that execute during request-response cycle...',
        'Database migrations: Scripts that modify database schema over time...'
      ],
      query: 'How to handle side effects in React?',
      expectedMatch: 'useEffect hook'
    },
    {
      type: 'Legal Documents',
      documents: [
        'Privacy Policy: We collect personal information to provide services...',
        'Terms of Service: By using our platform, you agree to these terms...',
        'GDPR Compliance: Users have the right to request data deletion...'
      ],
      query: 'What data do you collect about users?',
      expectedMatch: 'Privacy Policy'
    }
  ];

  useCases.forEach((useCase, index) => {
    console.log(`${index + 1}. ${useCase.type}:`);
    console.log(`   📚 Documents: ${useCase.documents.length} items`);
    console.log(`   ❓ Sample Query: "${useCase.query}"`);
    console.log(`   🎯 Expected Match: ${useCase.expectedMatch}`);
    console.log('');
  });
}

// Export for testing
export { vectorSearchDemo, addDocumentDemo, useCaseExamples };

// Run demo if called directly
if (require.main === module) {
  (async () => {
    try {
      await vectorSearchDemo();
      await addDocumentDemo();
      await useCaseExamples();
    } catch (error) {
      console.error('Demo failed:', error);
    }
  })();
}
