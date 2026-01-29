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

## Limitations

While CN Diagrams is useful for many scenarios, it may not be the right choice if:

### **You Need Advanced Diagram Features**
- **Custom shapes and icons**: Currently limited to basic node shapes. If you need detailed UML diagrams, flowcharts with specific shapes, or custom icons, consider tools like Draw.io, Lucidchart, or PlantUML
- **Advanced styling**: Limited customization of colors, fonts, and visual styles compared to dedicated diagramming tools
- **Sequence diagrams or timing diagrams**: This tool focuses on architecture/component diagrams, not behavioral diagrams

### **You Need Specific Layout Control**
- **Precise positioning**: Uses automatic force-directed layout. If you need exact manual control over node positions, traditional diagramming tools may be better
- **Standardized layouts**: If you need strict adherence to specific layout standards (e.g., layered hierarchical, grid-based), the automatic layout may not suit your needs

### **You Work With Non-Technical Teams**
- **No standalone editor**: Requires running a development server (not a simple desktop app)
- **YAML knowledge**: Team members need to be comfortable with YAML syntax and concepts
- **Technical setup**: Requires Node.js installation and familiarity with npm/web development

### **You Need Enterprise Features**
- **Collaboration**: Currently single-user focused, no real-time multi-user editing
- **Access control**: No built-in authentication or permissions
- **Audit trails**: No change tracking beyond git commits
- **Export options**: Limited export formats (no PDF, PNG, or SVG export yet)

### **You Have Large-Scale Diagrams**
- **Performance**: Browser-based rendering may struggle with hundreds of nodes
- **Memory constraints**: Complex diagrams with deep nesting might impact browser performance

### **You Need a Mature, Stable Project**
- **Version 0.0.1**: This is an early-stage project that may have bugs and breaking changes
- **Limited community**: Small user base means fewer resources, examples, and community support
- **No SLA or support**: No guaranteed support or maintenance timeline

## When CN Diagrams is Right For You

Consider CN Diagrams if you:
- Want diagrams versioned in git alongside your code
- Need architecture diagrams with complex, deeply nested hierarchies
- Prefer code-first with optional visual editing
- Work in a technical team comfortable with YAML and web tools
- Value automatic layout over manual positioning
- Want bidirectional code <-> visual editing
