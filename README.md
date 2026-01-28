# CN Diagrams

A diagrams-as-code solution for creating architecture diagrams with arbitrary levels of encapsulation. Inspired by C4 diagrams but with unlimited nesting depth.

## Features

- **Diagrams as Code**: Define architecture diagrams using YAML
- **Bidirectional Editing**: Edit via code OR visually - changes sync both ways
- **Arbitrary Encapsulation**: Nest components to any depth (unlike C4's fixed 4 levels)
- **Real-time Preview**: See diagram updates instantly as you edit
- **Interactive Diagrams**: Pan, zoom, and explore your architecture
- **Force-directed Layout**: Automatic deterministic arrangement using fCoSE algorithm
- **Schema-ready**: YAML format enables future JSON Schema validation and IDE intellisense

## Visual Editing

The diagram supports visual editing that updates the YAML code:

| Action | How |
|--------|-----|
| **Edit label** | Double-click on node or edge |
| **Delete** | Select element(s) and press Delete/Backspace |
| **Add node** | Right-click on canvas → "Add Node" |
| **Add child node** | Right-click on node → "Add Child Node" |
| **Add edge** | Click "Add Edge" button, then click source → target |
| **Reparent node** | Drag node into/out of a container |

All visual changes are immediately reflected in the YAML code, preserving comments and formatting.

## YAML Schema

```yaml
# Optional diagram metadata
name: string
description: string

# Required: list of nodes
nodes:
  - id: string           # Unique identifier
    label: string        # Display name
    description: string  # Optional description
    type: string         # Optional type (e.g., service, database, application)
    technology: string   # Optional technology stack
    children:            # Optional nested nodes
      - id: string
        label: string
        # ... same structure, infinitely nestable

# Optional: list of edges
edges:
  - id: string           # Optional unique identifier
    source: string       # Source node id
    target: string       # Target node id
    label: string        # Optional edge label
    description: string  # Optional description
    technology: string   # Optional technology/protocol
    style: solid|dashed|dotted  # Optional line style
```

## Example

```yaml
name: Cloud Architecture
description: Example microservices platform

nodes:
  - id: cloud
    label: Cloud Platform
    type: environment
    children:
      - id: k8s
        label: Kubernetes
        type: cluster
        children:
          - id: api
            label: API Service
            type: service
            technology: Node.js
          - id: worker
            label: Worker
            type: service
      - id: db
        label: Database
        type: database
        technology: PostgreSQL

  - id: client
    label: Client App
    type: application

edges:
  - source: client
    target: api
    label: HTTPS
  - source: api
    target: worker
    label: gRPC
  - source: api
    target: db
    label: queries
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
- **yaml** - AST-preserving YAML parsing and manipulation
- **TypeScript** - Type safety

## Building

```sh
npm run build
npm run preview
```
