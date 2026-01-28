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
	import YamlEditor from '$lib/components/YamlEditor.svelte';
	import cytoscape from 'cytoscape';
	import fcose from 'cytoscape-fcose';
	import expandCollapse from 'cytoscape-expand-collapse';

	// Register extensions
	cytoscape.use(fcose);
	expandCollapse(cytoscape);

	let cy: cytoscape.Core | null = null;
	let containerEl: HTMLDivElement;
	let expandCollapseApi: any = null;

	// UI state
	let contextMenu = $state<{ x: number; y: number; type: 'canvas' | 'node' | 'edge'; targetId?: string } | null>(null);
	let editingLabel = $state<{ id: string; type: 'node' | 'edge'; value: string } | null>(null);
	let edgeDrawingMode = $state(false);
	let edgeSourceNode = $state<string | null>(null);
	let statusMessage = $state<string>('');
	let showHelp = $state(false);

	// Track if update came from code or diagram
	let updateSource: 'code' | 'diagram' = 'code';

	// Cache for collapsed state persistence
	let collapsedNodes = new Set<string>();
	let previousDiagram: ReturnType<typeof parseCNDSL> | null = null;

	// Helper: Get all ancestor node IDs for a given node
	function getAncestors(nodeId: string, nodes: { id: string; parent?: string }[]): string[] {
		const ancestors: string[] = [];
		const nodeMap = new Map(nodes.map(n => [n.id, n]));

		let current = nodeMap.get(nodeId);
		while (current?.parent) {
			ancestors.push(current.parent);
			current = nodeMap.get(current.parent);
		}
		return ancestors;
	}

	// Helper: Find containers that need to be expanded due to edits
	function findContainersToExpand(
		oldDiagram: ReturnType<typeof parseCNDSL> | null,
		newDiagram: ReturnType<typeof parseCNDSL>
	): Set<string> {
		const toExpand = new Set<string>();

		if (!oldDiagram) return toExpand;

		const oldNodeIds = new Set(oldDiagram.nodes.map(n => n.id));
		const oldNodeMap = new Map(oldDiagram.nodes.map(n => [n.id, n]));
		const oldEdgeIds = new Set(oldDiagram.edges.map(e => e.id));
		const oldEdgeMap = new Map(oldDiagram.edges.map(e => [e.id, e]));

		// Check for new or modified nodes
		for (const node of newDiagram.nodes) {
			const oldNode = oldNodeMap.get(node.id);
			const isNew = !oldNodeIds.has(node.id);
			const isModified = oldNode && (
				oldNode.label !== node.label ||
				oldNode.description !== node.description ||
				oldNode.type !== node.type ||
				oldNode.technology !== node.technology ||
				oldNode.parent !== node.parent
			);

			if (isNew || isModified) {
				// Get ancestors and add collapsed ones to expand list
				const ancestors = getAncestors(node.id, newDiagram.nodes);
				for (const ancestorId of ancestors) {
					if (collapsedNodes.has(ancestorId)) {
						toExpand.add(ancestorId);
					}
				}
			}
		}

		// Check for deleted nodes - expand their former parent
		for (const oldNode of oldDiagram.nodes) {
			if (!newDiagram.nodes.some(n => n.id === oldNode.id)) {
				if (oldNode.parent && collapsedNodes.has(oldNode.parent)) {
					toExpand.add(oldNode.parent);
				}
			}
		}

		// Check for new or modified edges
		for (const edge of newDiagram.edges) {
			const oldEdge = oldEdgeMap.get(edge.id);
			const isNew = !oldEdgeIds.has(edge.id);
			const isModified = oldEdge && (
				oldEdge.label !== edge.label ||
				oldEdge.source !== edge.source ||
				oldEdge.target !== edge.target
			);

			if (isNew || isModified) {
				// Expand ancestors of both source and target
				const sourceAncestors = getAncestors(edge.source, newDiagram.nodes);
				const targetAncestors = getAncestors(edge.target, newDiagram.nodes);

				for (const ancestorId of [...sourceAncestors, ...targetAncestors]) {
					if (collapsedNodes.has(ancestorId)) {
						toExpand.add(ancestorId);
					}
				}
			}
		}

		// Check for deleted edges - expand containers of their endpoints
		for (const oldEdge of oldDiagram.edges) {
			if (!newDiagram.edges.some(e => e.id === oldEdge.id)) {
				const sourceAncestors = getAncestors(oldEdge.source, oldDiagram.nodes);
				const targetAncestors = getAncestors(oldEdge.target, oldDiagram.nodes);

				for (const ancestorId of [...sourceAncestors, ...targetAncestors]) {
					if (collapsedNodes.has(ancestorId)) {
						toExpand.add(ancestorId);
					}
				}
			}
		}

		return toExpand;
	}

	// Sample DSL to get started (YAML format)
	let code = $state(`# CN Diagram Example - Multi-level Nesting
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
				'label': 'data(displayLabel)',
				'text-valign': 'center',
				'text-halign': 'center',
				'color': '#fff',
				'text-outline-color': '#4a90d9',
				'text-outline-width': 2,
				'font-size': '11px',
				'min-width': '150px',
				'min-height': '60px',
				'padding': '25px',
				'shape': 'roundrectangle',
				'text-wrap': 'wrap',
				'text-max-width': '140px',
				'line-height': 1.3
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
				'label': 'data(displayLabel)',
				'font-size': '10px',
				'text-rotation': 'autorotate',
				'text-margin-y': -10,
				'color': '#4a5568',
				'text-wrap': 'wrap'
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
		},
		// Collapsed node styles
		{
			selector: '.cy-expand-collapse-collapsed-node',
			style: {
				'background-color': '#667eea',
				'border-color': '#5a67d8',
				'border-width': 3,
				'border-style': 'dashed',
				'text-valign': 'center',
				'text-halign': 'center',
				'color': '#fff',
				'text-outline-color': '#667eea',
				'text-outline-width': 2,
				'font-weight': 'bold'
			}
		}
	];

	function updateDiagram() {
		if (!cy) return;

		// Save current collapsed state before clearing
		if (expandCollapseApi) {
			const collapsedEles = cy.nodes('.cy-expand-collapse-collapsed-node');
			collapsedEles.forEach((node: any) => {
				collapsedNodes.add(node.id());
			});
		}

		const diagram = parseCNDSL(code);
		const elements = toCytoscapeElements(diagram);

		// Find which containers need to be expanded due to edits within them
		const containersToExpand = findContainersToExpand(previousDiagram, diagram);

		// Remove expanded containers from collapsed set
		for (const containerId of containersToExpand) {
			collapsedNodes.delete(containerId);
		}

		// Clean up stale node IDs (nodes that no longer exist)
		const currentNodeIds = new Set(diagram.nodes.map(n => n.id));
		for (const nodeId of collapsedNodes) {
			if (!currentNodeIds.has(nodeId)) {
				collapsedNodes.delete(nodeId);
			}
		}

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

				// Restore collapsed state after layout completes
				if (expandCollapseApi && collapsedNodes.size > 0) {
					// Collapse nodes that should remain collapsed (in reverse order for nested containers)
					const nodesToCollapse = cy?.nodes().filter((node: any) =>
						collapsedNodes.has(node.id()) && node.isParent()
					);
					if (nodesToCollapse && nodesToCollapse.length > 0) {
						// Sort by depth (deepest first) to collapse inner containers first
						const sorted = nodesToCollapse.sort((a: any, b: any) => {
							const depthA = getAncestors(a.id(), diagram.nodes).length;
							const depthB = getAncestors(b.id(), diagram.nodes).length;
							return depthB - depthA;
						});
						sorted.forEach((node: any) => {
							expandCollapseApi.collapse(node);
						});
					}
				}
			}
		} as fcose.FcoseLayoutOptions);
		layout.run();

		// Store current diagram for next comparison
		previousDiagram = diagram;

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

	// Expand/Collapse functions
	function collapseAll() {
		if (!expandCollapseApi || !cy) return;
		const parents = cy.nodes(':parent');
		if (parents.length > 0) {
			expandCollapseApi.collapseAll();
			// Update cache
			parents.forEach((node: any) => collapsedNodes.add(node.id()));
			showStatus('Collapsed all containers');
		}
	}

	function expandAll() {
		if (!expandCollapseApi || !cy) return;
		expandCollapseApi.expandAll();
		// Clear cache
		collapsedNodes.clear();
		showStatus('Expanded all containers');
	}

	function collapseNode(nodeId: string) {
		if (!expandCollapseApi || !cy) return;
		const node = cy.getElementById(nodeId);
		if (node && node.isParent()) {
			expandCollapseApi.collapse(node);
			collapsedNodes.add(nodeId);
		}
	}

	function expandNode(nodeId: string) {
		if (!expandCollapseApi || !cy) return;
		const node = cy.getElementById(nodeId);
		if (node) {
			expandCollapseApi.expand(node);
			collapsedNodes.delete(nodeId);
		}
	}

	onMount(() => {
		cy = cytoscape({
			container: containerEl,
			style,
			wheelSensitivity: 0.3,
			boxSelectionEnabled: true
		});

		// Initialize expand-collapse extension
		expandCollapseApi = (cy as any).expandCollapse({
			layoutBy: null, // We'll handle layout ourselves
			fisheye: false,
			animate: false,
			undoable: false,
			cueEnabled: true,
			expandCollapseCuePosition: 'top-left',
			expandCollapseCueSize: 16,
			expandCollapseCueLineSize: 8,
			expandCueImage: undefined,
			collapseCueImage: undefined,
			expandCollapseCueSensitivity: 1
		});

		// Expose cy for debugging
		(window as any).cy = cy;
		(window as any).expandCollapseApi = expandCollapseApi;

		// Event handlers
		cy.on('dblclick', 'node, edge', handleDoubleClick);
		cy.on('cxttap', handleContextMenu);
		cy.on('tap', 'node', handleNodeClick);
		cy.on('free', 'node', handleNodeDrop);

		// Show description on hover
		cy.on('mouseover', 'node, edge', (evt) => {
			const desc = evt.target.data('description');
			const tech = evt.target.data('technology');
			const type = evt.target.data('type');
			if (desc || type) {
				const parts = [];
				if (type) parts.push(`Type: ${type}`);
				if (desc) parts.push(desc);
				showStatus(parts.join(' | '));
			}
		});

		cy.on('mouseout', 'node, edge', () => {
			if (!edgeDrawingMode) {
				statusMessage = '';
			}
		});

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
	function handleCodeChange(newValue: string) {
		code = newValue;
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
		<div class="editor-wrapper">
			<YamlEditor value={code} onchange={handleCodeChange} />
		</div>
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
				<div class="toolbar-divider"></div>
				<button
					class="toolbar-btn"
					onclick={expandAll}
					title="Expand all containers"
				>
					Expand All
				</button>
				<button
					class="toolbar-btn"
					onclick={collapseAll}
					title="Collapse all containers"
				>
					Collapse All
				</button>
				<div class="toolbar-divider"></div>
				<button
					class="toolbar-btn"
					class:active={showHelp}
					onclick={() => showHelp = !showHelp}
					title="Show keyboard shortcuts and tips"
				>
					?
				</button>
			</div>
		</div>
		<div class="cytoscape-container" bind:this={containerEl}></div>
		{#if showHelp}
			<div class="help-panel">
				<div class="help-header">
					<span>Editing Guide</span>
					<button class="help-close" onclick={() => showHelp = false}>×</button>
				</div>
				<div class="help-content">
					<div class="help-section">
						<div class="help-title">Mouse Actions</div>
						<div class="help-item"><kbd>Double-click</kbd> Edit label</div>
						<div class="help-item"><kbd>Right-click</kbd> Context menu</div>
						<div class="help-item"><kbd>Drag node</kbd> Reparent to container</div>
						<div class="help-item"><kbd>Hover</kbd> View full description</div>
					</div>
					<div class="help-section">
						<div class="help-title">Keyboard</div>
						<div class="help-item"><kbd>Delete</kbd> Remove selected</div>
						<div class="help-item"><kbd>Esc</kbd> Cancel action</div>
					</div>
					<div class="help-section">
						<div class="help-title">Context Menu</div>
						<div class="help-item">Canvas: Add node/edge</div>
						<div class="help-item">Node: Add child, edit, move, delete</div>
						<div class="help-item">Edge: Edit label, delete</div>
					</div>
					<div class="help-section">
						<div class="help-title">Expand/Collapse</div>
						<div class="help-item"><kbd>Click cue</kbd> Toggle container</div>
						<div class="help-item">Use toolbar or right-click menu</div>
					</div>
				</div>
			</div>
		{/if}
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
			{@const node = cy?.getElementById(contextMenu?.targetId || '')}
			{@const isCollapsed = node?.hasClass('cy-expand-collapse-collapsed-node')}
			<button onclick={() => handleAddNode(contextMenu?.targetId)}>Add Child Node</button>
			<button onclick={() => { editingLabel = { id: contextMenu!.targetId!, type: 'node', value: cy?.getElementById(contextMenu!.targetId!).data('label') || '' }; closeContextMenu(); }}>Edit Label</button>
			{#if isCollapsed}
				<button onclick={() => { expandNode(contextMenu!.targetId!); closeContextMenu(); }}>Expand</button>
			{:else if node?.isParent()}
				<button onclick={() => { collapseNode(contextMenu!.targetId!); closeContextMenu(); }}>Collapse</button>
			{/if}
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

	.toolbar-divider {
		width: 1px;
		height: 20px;
		background: rgba(255, 255, 255, 0.3);
		margin: 0 4px;
	}

	.editor-wrapper {
		flex: 1;
		overflow: hidden;
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

	/* Help Panel */
	.help-panel {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 240px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		z-index: 100;
		overflow: hidden;
	}

	.help-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 14px;
		background: #2c5282;
		color: white;
		font-weight: 600;
		font-size: 13px;
	}

	.help-close {
		background: none;
		border: none;
		color: white;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		opacity: 0.8;
	}

	.help-close:hover {
		opacity: 1;
	}

	.help-content {
		padding: 12px 14px;
	}

	.help-section {
		margin-bottom: 12px;
	}

	.help-section:last-child {
		margin-bottom: 0;
	}

	.help-title {
		font-size: 11px;
		font-weight: 600;
		color: #718096;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 6px;
	}

	.help-item {
		font-size: 12px;
		color: #4a5568;
		margin-bottom: 4px;
		display: flex;
		gap: 8px;
	}

	.help-item kbd {
		background: #edf2f7;
		padding: 2px 6px;
		border-radius: 4px;
		font-family: inherit;
		font-size: 11px;
		color: #2d3748;
		min-width: 70px;
		text-align: center;
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
