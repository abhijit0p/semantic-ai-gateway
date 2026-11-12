export const ROUTING_CONFIG = {
  port: process.env.PORT || 4000,
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  embeddingModel: 'nomic-embed-text',
  similarityThreshold: 0.60,
  maxContextCharsBeforeTier2: 24000,

  models: {
    tier1: {
      id: 'gemini-3.8-flash',
      provider: 'gemini',
      label: 'Tier 1: Fast / Cost-Optimized',
      inputCostPer1M: 0.10,
      outputCostPer1M: 0.40,
      color: '#10b981'
    },
    tier2: {
      id: 'gpt-4o',
      provider: 'openai',
      label: 'Tier 2: Deep Reasoning',
      inputCostPer1M: 2.50,
      outputCostPer1M: 10.00,
      color: '#8b5cf6'
    }
  },

  // Multi-domain reference clusters for Tier 2 escalation
  tier2Clusters: {
    distributedSystems: [
      'distributed system architecture high availability failover active-active replication',
      'event-driven microservices saga pattern transactional outbox idempotency keys',
      'consensus algorithms raft paxos eventual consistency partition tolerance cap theorem'
    ],
    concurrencyAndSecurity: [
      'concurrency race conditions deadlock prevention distributed locking mutex semaphore',
      'cryptographic key rotation zero-trust authentication oauth2 token replay attack',
      'thread safety atomic compare-and-swap optimistic locking database isolation levels'
    ],
    performanceAndData: [
      'database query execution plan composite indexing sharding partitioning bottleneck',
      'memory leak profiling garbage collection tuning backpressure stream processing',
      'algorithmic time complexity reduction dynamic programming graph traversal optimization'
    ]
  }
};