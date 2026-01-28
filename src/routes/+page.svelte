<script lang="ts">
	import { onMount } from 'svelte';
	import { parseCNDSL, toCytoscapeElements } from '$lib/parser';
	import {
		updateNodeLabel,
		updateEdgeLabel,
		deleteNode,
		deleteEdge,
		addNode,
		addEdge,
		reparentNode,
		generateNodeId,
		getAllNodeIds,
		getNodeParentId
	} from '$lib/yaml-editor';
	import cytoscape from 'cytoscape';
	import fcose from 'cytoscape-fcose';

	// Register fCoSE layout
	cytoscape.use(fcose);

	let cy: cytoscape.Core | null = null;
	let containerEl: HTMLDivElement;

	// UI state
	let contextMenu = $state<{ x: number; y: number; type: 'canvas' | 'node' | 'edge'; targetId?: string } | null>(null);
	let editingLabel = $state<{ id: string; type: 'node' | 'edge'; value: string } | null>(null);
	let edgeDrawingMode = $state(false);
	let edgeSourceNode = $state<string | null>(null);
	let statusMessage = $state<string>('');

	// Track if update came from code or diagram
	let updateSource: 'code' | 'diagram' = 'code';

	// Sample DSL to get started (YAML format)
	let code = $state(`# CN Diagram Example - Multi-level Nesting
name: Cloud Platform Architecture
description: A cloud platform with multiple levels of encapsulation

nodes:
  - id: cloud
    label: Cloud Platform
    type: environment
    children:
      - id: k8s
        label: Kubernetes Cluster
        type: cluster
        children:
          - id: backend
            label: Backend System
            type: system
            children:
              - id: api
                label: API Gateway
                type: service
                technology: Node.js
              - id: auth
                label: Auth Service
                type: service
                technology: Node.js
          - id: data
            label: Data Layer
            type: system
            children:
              - id: db
                label: Database
                type: database
                technology: PostgreSQL
              - id: cache
                label: Redis Cache
                type: cache
                technology: Redis

  - id: frontend
    label: Frontend App
    type: application
    technology: React

  - id: mobile
    label: Mobile App
    type: application
    technology: React Native

edges:
  - source: frontend
    target: api
    label: REST API
  - source: mobile
    target: api
    label: REST API
  - source: api
    target: auth
    label: validates
  - source: api
    target: db
    label: queries
  - source: api
    target: cache
    label: caches
`);

	// Simple hash function for deterministic positioning
	function hashCode(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return hash;
	}

	// Generate deterministic initial position based on node ID
	function getInitialPosition(nodeId: string, index: number): { x: number; y: number } {
		const hash = hashCode(nodeId);
		// Use hash to generate position in a grid-like pattern with some variation
		const gridSize = 200;
		const col = (Math.abs(hash) % 10);
		const row = (Math.abs(hash >> 8) % 10);
		return {
			x: col * gridSize + (hash % 50),
			y: row * gridSize + ((hash >> 4) % 50)
		};
	}

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
			selector: 'node:selected',
			style: {
				'border-width': 3,
				'border-color': '#e53e3e'
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
		},
		{
			selector: 'edge:selected',
			style: {
				'line-color': '#e53e3e',
				'target-arrow-color': '#e53e3e',
				'width': 3
			}
		},
		{
			selector: '.edge-source',
			style: {
				'border-width': 3,
				'border-color': '#38a169'
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

		// Set deterministic initial positions based on node ID hashes
		cy.nodes().forEach((node, index) => {
			const pos = getInitialPosition(node.id(), index);
			node.position(pos);
		});

		// Run layout with deterministic settings
		const layout = cy.layout({
			name: 'fcose',
			quality: 'proof',
			animate: false,
			animationDuration: 500,
			animationEasing: 'ease-out',
			fit: true,
			padding: 50,
			randomize: false,
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

		// Reset update source
		updateSource = 'code';
	}

	function updateCodeFromDiagram(newCode: string) {
		updateSource = 'diagram';
		code = newCode;
		updateDiagram();
	}

	// --- Visual Editing Handlers ---

	function handleDoubleClick(evt: cytoscape.EventObject) {
		const target = evt.target;
		if (target === cy) return;

		if (target.isNode()) {
			editingLabel = {
				id: target.id(),
				type: 'node',
				value: target.data('label') || ''
			};
		} else if (target.isEdge()) {
			editingLabel = {
				id: target.id(),
				type: 'edge',
				value: target.data('label') || ''
			};
		}
	}

	function handleLabelEditSubmit() {
		if (!editingLabel) return;

		const newCode = editingLabel.type === 'node'
			? updateNodeLabel(code, editingLabel.id, editingLabel.value)
			: updateEdgeLabel(code, editingLabel.id, editingLabel.value);

		updateCodeFromDiagram(newCode);
		editingLabel = null;
		showStatus('Label updated');
	}

	function handleLabelEditCancel() {
		editingLabel = null;
	}

	function handleKeyDown(evt: KeyboardEvent) {
		// Close context menu on Escape
		if (evt.key === 'Escape') {
			contextMenu = null;
			editingLabel = null;
			if (edgeDrawingMode) {
				cancelEdgeDrawing();
			}
			return;
		}

		// Delete selected elements
		if ((evt.key === 'Delete' || evt.key === 'Backspace') && !editingLabel) {
			const selected = cy?.elements(':selected');
			if (selected && selected.length > 0) {
				evt.preventDefault();
				let newCode = code;

				const selectedNodes = selected.filter('node');
				const selectedEdges = selected.filter('edge');

				selectedNodes.forEach((node) => {
					newCode = deleteNode(newCode, node.id());
				});

				selectedEdges.forEach((edge) => {
					newCode = deleteEdge(newCode, edge.id());
				});

				updateCodeFromDiagram(newCode);
				showStatus(`Deleted ${selected.length} element(s)`);
			}
		}
	}

	function handleContextMenu(evt: cytoscape.EventObject) {
		evt.originalEvent?.preventDefault();

		const target = evt.target;
		const pos = evt.renderedPosition || evt.position;

		if (target === cy) {
			contextMenu = { x: pos.x, y: pos.y, type: 'canvas' };
		} else if (target.isNode()) {
			contextMenu = { x: pos.x, y: pos.y, type: 'node', targetId: target.id() };
		} else if (target.isEdge()) {
			contextMenu = { x: pos.x, y: pos.y, type: 'edge', targetId: target.id() };
		}
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function handleAddNode(parentId?: string) {
		const label = prompt('Enter node label:');
		if (!label) {
			closeContextMenu();
			return;
		}

		const existingIds = getAllNodeIds(code);
		const id = generateNodeId(label, existingIds);

		const newCode = addNode(code, { id, label }, parentId);
		updateCodeFromDiagram(newCode);
		closeContextMenu();
		showStatus(`Added node "${label}"`);
	}

	function handleDeleteNode(nodeId: string) {
		const newCode = deleteNode(code, nodeId);
		updateCodeFromDiagram(newCode);
		closeContextMenu();
		showStatus('Node deleted');
	}

	function handleDeleteEdge(edgeId: string) {
		const newCode = deleteEdge(code, edgeId);
		updateCodeFromDiagram(newCode);
		closeContextMenu();
		showStatus('Edge deleted');
	}

	function handleMoveToRoot(nodeId: string) {
		const newCode = reparentNode(code, nodeId, null);
		updateCodeFromDiagram(newCode);
		closeContextMenu();
		showStatus('Moved to root');
	}

	function handleMoveToParent(nodeId: string) {
		const currentParentId = getNodeParentId(code, nodeId);
		if (!currentParentId) return;

		// Get the grandparent (parent's parent)
		const grandparentId = getNodeParentId(code, currentParentId);

		const newCode = reparentNode(code, nodeId, grandparentId || null);
		updateCodeFromDiagram(newCode);
		closeContextMenu();
		showStatus(grandparentId ? `Moved to ${grandparentId}` : 'Moved to root');
	}

	function startEdgeDrawing() {
		edgeDrawingMode = true;
		edgeSourceNode = null;
		closeContextMenu();
		showStatus('Click on source node, then target node');
	}

	function cancelEdgeDrawing() {
		edgeDrawingMode = false;
		edgeSourceNode = null;
		cy?.nodes().removeClass('edge-source');
		showStatus('');
	}

	function handleNodeClickForEdge(nodeId: string) {
		if (!edgeDrawingMode) return;

		if (!edgeSourceNode) {
			edgeSourceNode = nodeId;
			cy?.getElementById(nodeId).addClass('edge-source');
			showStatus(`Source: ${nodeId}. Now click target node.`);
		} else if (nodeId !== edgeSourceNode) {
			// Create edge
			const label = prompt('Enter edge label (optional):') || undefined;
			const newCode = addEdge(code, {
				source: edgeSourceNode,
				target: nodeId,
				label
			});

			cy?.nodes().removeClass('edge-source');
			updateCodeFromDiagram(newCode);
			edgeDrawingMode = false;
			edgeSourceNode = null;
			showStatus('Edge created');
		}
	}

	function handleNodeClick(evt: cytoscape.EventObject) {
		if (edgeDrawingMode && evt.target.isNode()) {
			handleNodeClickForEdge(evt.target.id());
		}
	}

	// Reparenting via drag
	function handleNodeDrop(evt: cytoscape.EventObject) {
		const node = evt.target;
		const nodeId = node.id();
		const position = evt.position;

		// Find if dropped on a parent node
		const potentialParents = cy?.nodes().filter((n) => {
			if (n.id() === nodeId) return false;
			if (n.isParent() || !n.isChildless()) {
				// It's a container or has children
				const bb = n.boundingBox();
				return position.x >= bb.x1 && position.x <= bb.x2 &&
					position.y >= bb.y1 && position.y <= bb.y2;
			}
			return false;
		});

		const currentParent = node.data('parent');
		let newParentId: string | null = null;

		if (potentialParents && potentialParents.length > 0) {
			// Find the innermost (smallest) container
			let smallest = potentialParents[0];
			let smallestArea = Infinity;

			potentialParents.forEach((p) => {
				const bb = p.boundingBox();
				const area = bb.w * bb.h;
				if (area < smallestArea) {
					smallestArea = area;
					smallest = p;
				}
			});

			newParentId = smallest.id();
		}

		// Only reparent if parent changed
		if (newParentId !== currentParent) {
			const newCode = reparentNode(code, nodeId, newParentId);
			updateCodeFromDiagram(newCode);
			showStatus(newParentId ? `Moved to ${newParentId}` : 'Moved to root');
		}
	}

	function showStatus(message: string) {
		statusMessage = message;
		if (message) {
			setTimeout(() => {
				if (statusMessage === message) {
					statusMessage = '';
				}
			}, 3000);
		}
	}

	onMount(() => {
		cy = cytoscape({
			container: containerEl,
			style,
			wheelSensitivity: 0.3,
			boxSelectionEnabled: true
		});

		// Expose cy for debugging
		(window as any).cy = cy;

		// Event handlers
		cy.on('dblclick', 'node, edge', handleDoubleClick);
		cy.on('cxttap', handleContextMenu);
		cy.on('tap', 'node', handleNodeClick);
		cy.on('free', 'node', handleNodeDrop);

		// Close context menu on canvas click
		cy.on('tap', (evt) => {
			if (evt.target === cy) {
				closeContextMenu();
			}
		});

		updateDiagram();

		return () => {
			cy?.destroy();
		};
	});

	// Debounce updates from code editor
	let timeout: ReturnType<typeof setTimeout>;
	function handleInput() {
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			updateSource = 'code';
			updateDiagram();
		}, 300);
	}
</script>

<svelte:head>
	<title>CN Diagrams</title>
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />

<div class="container">
	<div class="editor-pane">
		<div class="header">
			CN DSL Editor
			<span class="header-hint">YAML format</span>
		</div>
		<textarea
			bind:value={code}
			oninput={handleInput}
			spellcheck="false"
			placeholder="Enter your CN diagram DSL here..."
		></textarea>
	</div>
	<div class="diagram-pane">
		<div class="header">
			Diagram
			<div class="toolbar">
				<button
					class="toolbar-btn"
					class:active={edgeDrawingMode}
					onclick={() => edgeDrawingMode ? cancelEdgeDrawing() : startEdgeDrawing()}
					title="Draw edge between nodes"
				>
					{edgeDrawingMode ? 'Cancel' : 'Add Edge'}
				</button>
			</div>
		</div>
		<div class="cytoscape-container" bind:this={containerEl}></div>
		{#if statusMessage}
			<div class="status-bar">{statusMessage}</div>
		{/if}
	</div>
</div>

<!-- Context Menu -->
{#if contextMenu}
	<div
		class="context-menu"
		style="left: {contextMenu.x + 560}px; top: {contextMenu.y + 45}px"
	>
		{#if contextMenu.type === 'canvas'}
			<button onclick={() => handleAddNode()}>Add Node</button>
			<button onclick={startEdgeDrawing}>Add Edge</button>
		{:else if contextMenu.type === 'node'}
			<button onclick={() => handleAddNode(contextMenu?.targetId)}>Add Child Node</button>
			<button onclick={() => { editingLabel = { id: contextMenu!.targetId!, type: 'node', value: cy?.getElementById(contextMenu!.targetId!).data('label') || '' }; closeContextMenu(); }}>Edit Label</button>
			{#if cy?.getElementById(contextMenu?.targetId || '').data('parent')}
				<button onclick={() => handleMoveToParent(contextMenu!.targetId!)}>Move to Parent</button>
				{#if getNodeParentId(code, cy?.getElementById(contextMenu?.targetId || '').data('parent'))}
					<button onclick={() => handleMoveToRoot(contextMenu!.targetId!)}>Move to Root</button>
				{/if}
			{/if}
			<button class="danger" onclick={() => handleDeleteNode(contextMenu!.targetId!)}>Delete Node</button>
		{:else if contextMenu.type === 'edge'}
			<button onclick={() => { editingLabel = { id: contextMenu!.targetId!, type: 'edge', value: cy?.getElementById(contextMenu!.targetId!).data('label') || '' }; closeContextMenu(); }}>Edit Label</button>
			<button class="danger" onclick={() => handleDeleteEdge(contextMenu!.targetId!)}>Delete Edge</button>
		{/if}
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="context-menu-overlay" onclick={closeContextMenu}></div>
{/if}

<!-- Label Edit Modal -->
{#if editingLabel}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="modal-overlay" onclick={handleLabelEditCancel}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<h3>Edit {editingLabel.type === 'node' ? 'Node' : 'Edge'} Label</h3>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				bind:value={editingLabel.value}
				onkeydown={(e) => {
					if (e.key === 'Enter') handleLabelEditSubmit();
					if (e.key === 'Escape') handleLabelEditCancel();
				}}
				autofocus
			/>
			<div class="modal-buttons">
				<button onclick={handleLabelEditCancel}>Cancel</button>
				<button class="primary" onclick={handleLabelEditSubmit}>Save</button>
			</div>
		</div>
	</div>
{/if}

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
		position: relative;
	}

	.header {
		padding: 12px 16px;
		background: #2c5282;
		color: white;
		font-weight: 600;
		font-size: 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-hint {
		font-size: 11px;
		opacity: 0.7;
		font-weight: normal;
	}

	.toolbar {
		display: flex;
		gap: 8px;
	}

	.toolbar-btn {
		padding: 4px 12px;
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 4px;
		color: white;
		font-size: 12px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.toolbar-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.toolbar-btn.active {
		background: #38a169;
		border-color: #38a169;
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

	.status-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 8px 16px;
		background: rgba(0, 0, 0, 0.8);
		color: white;
		font-size: 12px;
	}

	/* Context Menu */
	.context-menu {
		position: fixed;
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		min-width: 150px;
		overflow: hidden;
	}

	.context-menu button {
		display: block;
		width: 100%;
		padding: 10px 16px;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		font-size: 13px;
		color: #2d3748;
	}

	.context-menu button:hover {
		background: #edf2f7;
	}

	.context-menu button.danger {
		color: #e53e3e;
	}

	.context-menu button.danger:hover {
		background: #fed7d7;
	}

	.context-menu-overlay {
		position: fixed;
		inset: 0;
		z-index: 999;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}

	.modal {
		background: white;
		padding: 24px;
		border-radius: 12px;
		min-width: 300px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
	}

	.modal h3 {
		margin: 0 0 16px 0;
		font-size: 16px;
		color: #2d3748;
	}

	.modal input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 14px;
		outline: none;
		box-sizing: border-box;
	}

	.modal input:focus {
		border-color: #4a90d9;
		box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.2);
	}

	.modal-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
	}

	.modal-buttons button {
		padding: 8px 16px;
		border-radius: 6px;
		border: 1px solid #e2e8f0;
		background: white;
		cursor: pointer;
		font-size: 13px;
	}

	.modal-buttons button.primary {
		background: #4a90d9;
		border-color: #4a90d9;
		color: white;
	}

	.modal-buttons button:hover {
		opacity: 0.9;
	}
</style>
