<script lang="ts">
	import { onMount } from 'svelte';
	import { parseCNDSL, toCytoscapeElements } from '$lib/parser';
	import cytoscape from 'cytoscape';
	import fcose from 'cytoscape-fcose';

	// Register fCoSE layout
	cytoscape.use(fcose);

	let cy: cytoscape.Core | null = null;
	let containerEl: HTMLDivElement;

	// Sample DSL to get started (YAML format)
	let code = $state(`# CN Diagram Example
name: Sample Architecture
description: A simple backend system with clients

nodes:
  - id: backend
    label: Backend System
    description: Core backend services
    type: system
    children:
      - id: api
        label: API Gateway
        description: REST API endpoint
        type: service
        technology: Node.js
      - id: auth
        label: Auth Service
        description: Authentication and authorization
        type: service
        technology: Node.js
      - id: db
        label: Database
        description: Primary data store
        type: database
        technology: PostgreSQL

  - id: frontend
    label: Frontend App
    description: Web application
    type: application
    technology: React

  - id: mobile
    label: Mobile App
    description: iOS and Android apps
    type: application
    technology: React Native

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
  - source: api
    target: db
    label: queries
    technology: SQL
`);

	// Cytoscape stylesheet
	const style: cytoscape.StylesheetStyle[] = [
		{
			selector: 'node',
			style: {
				'background-color': '#4a90d9',
				'label': 'data(label)',
				'text-valign': 'center',
				'text-halign': 'center',
				'color': '#fff',
				'text-outline-color': '#4a90d9',
				'text-outline-width': 2,
				'font-size': '14px',
				'min-width': '120px',
				'min-height': '40px',
				'padding': '15px',
				'shape': 'roundrectangle',
				'text-wrap': 'wrap',
				'text-max-width': '100px'
			}
		},
		{
			selector: 'node:parent',
			style: {
				'background-color': '#e8f4f8',
				'background-opacity': 0.8,
				'border-color': '#2c5282',
				'border-width': 2,
				'text-valign': 'top',
				'text-halign': 'center',
				'color': '#2c5282',
				'text-outline-width': 0,
				'font-weight': 'bold',
				'padding': '30px'
			}
		},
		{
			selector: 'edge',
			style: {
				'width': 2,
				'line-color': '#718096',
				'target-arrow-color': '#718096',
				'target-arrow-shape': 'triangle',
				'curve-style': 'bezier',
				'label': 'data(label)',
				'font-size': '10px',
				'text-rotation': 'autorotate',
				'text-margin-y': -10,
				'color': '#4a5568'
			}
		}
	];

	function updateDiagram() {
		if (!cy) return;

		const diagram = parseCNDSL(code);
		const elements = toCytoscapeElements(diagram);

		// Update elements
		cy.elements().remove();
		cy.add(elements);

		// Run layout
		const layout = cy.layout({
			name: 'fcose',
			animate: true,
			animationDuration: 500,
			animationEasing: 'ease-out',
			fit: true,
			padding: 50,
			randomize: true,
			nodeDimensionsIncludeLabels: true,
			packComponents: true,
			nodeRepulsion: () => 4500,
			idealEdgeLength: () => 100,
			edgeElasticity: () => 0.45,
			nestingFactor: 0.1,
			gravity: 0.25,
			gravityRange: 3.8,
			gravityCompound: 1.0,
			gravityRangeCompound: 1.5,
			numIter: 2500,
			tile: true,
			tilingPaddingVertical: 10,
			tilingPaddingHorizontal: 10,
			stop: () => {
				cy?.fit(undefined, 50);
			}
		} as fcose.FcoseLayoutOptions);
		layout.run();
	}

	onMount(() => {
		cy = cytoscape({
			container: containerEl,
			style,
			wheelSensitivity: 0.3
		});

		// Expose cy for debugging
		(window as any).cy = cy;

		updateDiagram();

		return () => {
			cy?.destroy();
		};
	});

	// Debounce updates
	let timeout: ReturnType<typeof setTimeout>;
	function handleInput() {
		clearTimeout(timeout);
		timeout = setTimeout(updateDiagram, 300);
	}
</script>

<svelte:head>
	<title>CN Diagrams</title>
</svelte:head>

<div class="container">
	<div class="editor-pane">
		<div class="header">CN DSL Editor</div>
		<textarea
			bind:value={code}
			oninput={handleInput}
			spellcheck="false"
			placeholder="Enter your CN diagram DSL here..."
		></textarea>
	</div>
	<div class="diagram-pane">
		<div class="header">Diagram</div>
		<div class="cytoscape-container" bind:this={containerEl}></div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
	}

	.container {
		display: flex;
		height: 100vh;
		width: 100vw;
	}

	.editor-pane {
		width: 40%;
		display: flex;
		flex-direction: column;
		border-right: 1px solid #e2e8f0;
	}

	.diagram-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.header {
		padding: 12px 16px;
		background: #2c5282;
		color: white;
		font-weight: 600;
		font-size: 14px;
	}

	textarea {
		flex: 1;
		resize: none;
		border: none;
		padding: 16px;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 13px;
		line-height: 1.5;
		background: #1a202c;
		color: #e2e8f0;
		outline: none;
	}

	textarea::placeholder {
		color: #718096;
	}

	.cytoscape-container {
		flex: 1;
		background: #f7fafc;
	}
</style>
