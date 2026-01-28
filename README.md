# CN Diagrams

A diagrams-as-code solution for creating architecture diagrams with arbitrary levels of encapsulation. Inspired by C4 diagrams but with unlimited nesting depth.

## Features

- **Diagrams as Code**: Define architecture diagrams using a simple DSL
- **Arbitrary Encapsulation**: Nest components to any depth (unlike C4's fixed 4 levels)
- **Real-time Preview**: See diagram updates instantly as you edit the code
- **Interactive Diagrams**: Pan, zoom, and explore your architecture
- **Force-directed Layout**: Automatic arrangement using fCoSE algorithm

## DSL Syntax

```
# Comments start with #

# Define nodes with optional nesting
node <id> "<label>" {
  node <child-id> "<child-label>"
}

# Define edges between nodes
edge <source> -> <target> "<label>"
```

### Example

```
node cloud "Cloud Platform" {
  node k8s "Kubernetes" {
    node api "API Service"
    node worker "Worker"
  }
  node db "Database"
}

node client "Client App"

edge client -> api "HTTPS"
edge api -> worker "gRPC"
edge api -> db "queries"
```

## Getting Started

```sh
# Install dependencies
npm install

# Start development server
npm run dev
```

Then open http://localhost:5173 in your browser.

## Technology Stack

- **Svelte 5** - Frontend framework with runes
- **Cytoscape.js** - Graph visualization library
- **fCoSE Layout** - Force-directed layout for compound graphs
- **TypeScript** - Type safety

## Building

```sh
npm run build
npm run preview
```
