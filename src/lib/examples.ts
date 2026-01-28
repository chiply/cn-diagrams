// Example CN Diagrams ranging from simple to complex

export interface Example {
	id: string;
	name: string;
	complexity: 'simple' | 'medium' | 'complex';
	yaml: string;
}

export const examples: Example[] = [
	{
		id: 'simple-webapp',
		name: 'Simple Web App',
		complexity: 'simple',
		yaml: `# Simple Web Application
name: Simple Web App
description: A basic three-tier web application

nodes:
  - id: browser
    label: Web Browser
    type: browser
    description: User's web browser

  - id: webapp
    label: Web Server
    type: service
    technology: Node.js
    description: Express.js application

  - id: database
    label: Database
    type: database
    technology: PostgreSQL
    description: Relational database

edges:
  - source: browser
    target: webapp
    label: HTTP requests
    technology: HTTPS
  - source: webapp
    target: database
    label: queries
    technology: TCP
`
	},
	{
		id: 'medium-ecommerce',
		name: 'E-Commerce Platform',
		complexity: 'medium',
		yaml: `# E-Commerce Platform
name: E-Commerce Platform
description: Online shopping platform with microservices

nodes:
  - id: clients
    label: Clients
    type: system
    children:
      - id: web
        label: Web App
        type: application
        technology: React
        description: Customer-facing website
      - id: mobile
        label: Mobile App
        type: application
        technology: React Native
        description: iOS and Android app

  - id: gateway
    label: API Gateway
    type: service
    technology: Kong
    description: Routes and rate limits

  - id: services
    label: Backend Services
    type: system
    children:
      - id: products
        label: Product Service
        type: service
        technology: Node.js
        description: Product catalog
      - id: orders
        label: Order Service
        type: service
        technology: Java
        description: Order processing
      - id: users
        label: User Service
        type: service
        technology: Go
        description: Authentication & profiles
      - id: payments
        label: Payment Service
        type: service
        technology: Python
        description: Payment processing

  - id: data
    label: Data Stores
    type: system
    children:
      - id: postgres
        label: PostgreSQL
        type: database
        technology: PostgreSQL
        description: Orders and users
      - id: mongo
        label: MongoDB
        type: database
        technology: MongoDB
        description: Product catalog
      - id: redis
        label: Redis
        type: cache
        technology: Redis
        description: Session cache

edges:
  - source: web
    target: gateway
    label: API calls
    technology: HTTPS
  - source: mobile
    target: gateway
    label: API calls
    technology: HTTPS
  - source: gateway
    target: products
    label: routes
    technology: HTTP
  - source: gateway
    target: orders
    label: routes
    technology: HTTP
  - source: gateway
    target: users
    label: routes
    technology: HTTP
  - source: orders
    target: payments
    label: process payment
    technology: gRPC
  - source: products
    target: mongo
    label: queries
    technology: TCP
  - source: orders
    target: postgres
    label: queries
    technology: TCP
  - source: users
    target: postgres
    label: queries
    technology: TCP
  - source: users
    target: redis
    label: sessions
    technology: TCP
`
	},
	{
		id: 'complex-cloud',
		name: 'Cloud Platform',
		complexity: 'complex',
		yaml: `# Cloud Platform Architecture
name: Cloud Platform Architecture
description: A cloud platform with multiple levels of encapsulation

nodes:
  - id: cloud
    label: Cloud Platform
    type: environment
    description: AWS Cloud Infrastructure
    children:
      - id: k8s
        label: Kubernetes Cluster
        type: cluster
        description: EKS managed cluster
        children:
          - id: backend
            label: Backend System
            type: system
            children:
              - id: api
                label: API Gateway
                type: service
                technology: Node.js
                description: Handles all incoming API requests
              - id: auth
                label: Auth Service
                type: service
                technology: Node.js
                description: JWT authentication and authorization
          - id: data
            label: Data Layer
            type: system
            children:
              - id: db
                label: Database
                type: database
                technology: PostgreSQL
                description: Primary data store
              - id: cache
                label: Redis Cache
                type: cache
                technology: Redis
                description: Session and query caching

  - id: frontend
    label: Frontend App
    type: application
    technology: React
    description: Single-page web application

  - id: mobile
    label: Mobile App
    type: application
    technology: React Native
    description: Cross-platform mobile app

edges:
  - source: frontend
    target: api
    label: REST API
    technology: HTTPS
  - source: mobile
    target: api
    label: REST API
    technology: HTTPS
  - source: api
    target: auth
    label: validates
    technology: gRPC
  - source: api
    target: db
    label: queries
    technology: TCP
  - source: api
    target: cache
    label: caches
    technology: TCP
`
	},
	{
		id: 'complex-event-driven',
		name: 'Event-Driven Architecture',
		complexity: 'complex',
		yaml: `# Event-Driven Microservices
name: Event-Driven Architecture
description: Microservices communicating via message queues

nodes:
  - id: ingress
    label: Ingress Layer
    type: system
    children:
      - id: lb
        label: Load Balancer
        type: service
        technology: nginx
        description: Traffic distribution
      - id: gateway
        label: API Gateway
        type: service
        technology: Kong
        description: Auth and routing

  - id: services
    label: Domain Services
    type: system
    description: Core business logic
    children:
      - id: inventory
        label: Inventory
        type: service
        technology: Go
        description: Stock management
      - id: orders
        label: Orders
        type: service
        technology: Java
        description: Order lifecycle
      - id: shipping
        label: Shipping
        type: service
        technology: Python
        description: Delivery tracking
      - id: notifications
        label: Notifications
        type: service
        technology: Node.js
        description: Email and push

  - id: messaging
    label: Message Broker
    type: system
    children:
      - id: kafka
        label: Kafka
        type: queue
        technology: Apache Kafka
        description: Event streaming
      - id: rabbitmq
        label: RabbitMQ
        type: queue
        technology: RabbitMQ
        description: Task queues

  - id: storage
    label: Data Layer
    type: system
    children:
      - id: postgres
        label: PostgreSQL
        type: database
        technology: PostgreSQL
        description: Transactional data
      - id: elastic
        label: Elasticsearch
        type: database
        technology: Elasticsearch
        description: Search index
      - id: s3
        label: Object Storage
        type: storage
        technology: AWS S3
        description: Files and images

edges:
  - source: lb
    target: gateway
    label: forwards
    technology: HTTP
  - source: gateway
    target: orders
    label: routes
    technology: HTTP
  - source: gateway
    target: inventory
    label: routes
    technology: HTTP
  - source: orders
    target: kafka
    label: publishes events
    technology: TCP
  - source: inventory
    target: kafka
    label: publishes events
    technology: TCP
  - source: kafka
    target: shipping
    label: order.created
    technology: TCP
  - source: kafka
    target: notifications
    label: order.shipped
    technology: TCP
  - source: shipping
    target: rabbitmq
    label: delivery tasks
    technology: AMQP
  - source: notifications
    target: rabbitmq
    label: email tasks
    technology: AMQP
  - source: orders
    target: postgres
    label: persists
    technology: TCP
  - source: inventory
    target: postgres
    label: persists
    technology: TCP
  - source: orders
    target: elastic
    label: indexes
    technology: HTTP
`
	},
	{
		id: 'complex-fintech',
		name: 'FinTech Platform',
		complexity: 'complex',
		yaml: `# FinTech Platform Architecture
name: FinTech Platform
description: Financial services platform with security layers

nodes:
  - id: external
    label: External Zone
    type: environment
    description: Public-facing components
    children:
      - id: cdn
        label: CDN
        type: service
        technology: CloudFront
        description: Static assets
      - id: waf
        label: WAF
        type: service
        technology: AWS WAF
        description: Web application firewall
      - id: webapp
        label: Web Portal
        type: application
        technology: React
        description: Customer dashboard

  - id: dmz
    label: DMZ
    type: environment
    description: Demilitarized zone
    children:
      - id: apigw
        label: API Gateway
        type: service
        technology: Kong
        description: Rate limiting and auth
      - id: oauth
        label: OAuth Server
        type: service
        technology: Keycloak
        description: Identity provider

  - id: internal
    label: Internal Zone
    type: environment
    description: Protected services
    children:
      - id: core
        label: Core Banking
        type: system
        children:
          - id: accounts
            label: Accounts
            type: service
            technology: Java
            description: Account management
          - id: transactions
            label: Transactions
            type: service
            technology: Java
            description: Transaction processing
          - id: ledger
            label: Ledger
            type: service
            technology: Rust
            description: Double-entry ledger

      - id: compliance
        label: Compliance
        type: system
        children:
          - id: kyc
            label: KYC Service
            type: service
            technology: Python
            description: Know your customer
          - id: aml
            label: AML Service
            type: service
            technology: Python
            description: Anti-money laundering
          - id: fraud
            label: Fraud Detection
            type: service
            technology: Python
            description: ML-based fraud detection

  - id: data
    label: Data Zone
    type: environment
    description: Secure data storage
    children:
      - id: maindb
        label: Core Database
        type: database
        technology: Oracle
        description: ACID transactions
      - id: audit
        label: Audit Log
        type: database
        technology: TimescaleDB
        description: Immutable audit trail
      - id: vault
        label: Secrets Vault
        type: service
        technology: HashiCorp Vault
        description: Encryption keys

edges:
  - source: cdn
    target: webapp
    label: serves
    technology: HTTPS
  - source: webapp
    target: waf
    label: requests
    technology: HTTPS
  - source: waf
    target: apigw
    label: filters
    technology: HTTPS
  - source: apigw
    target: oauth
    label: authenticates
    technology: HTTPS
  - source: apigw
    target: accounts
    label: routes
    technology: mTLS
  - source: apigw
    target: transactions
    label: routes
    technology: mTLS
  - source: transactions
    target: ledger
    label: records
    technology: gRPC
  - source: transactions
    target: fraud
    label: validates
    technology: gRPC
  - source: accounts
    target: kyc
    label: verifies
    technology: gRPC
  - source: ledger
    target: maindb
    label: persists
    technology: TCP
  - source: transactions
    target: audit
    label: logs
    technology: TCP
  - source: ledger
    target: vault
    label: encrypts
    technology: mTLS
`
	}
];

export function getExampleById(id: string): Example | undefined {
	return examples.find(e => e.id === id);
}

export function getExamplesByComplexity(complexity: 'simple' | 'medium' | 'complex'): Example[] {
	return examples.filter(e => e.complexity === complexity);
}
