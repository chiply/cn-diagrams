// YAML AST manipulation utilities for bidirectional sync
// Uses the 'yaml' package which preserves formatting and comments

import { Document, parseDocument, YAMLSeq, YAMLMap, Scalar, isSeq, isMap } from 'yaml';

export interface NodeData {
	id: string;
	label: string;
	description?: string;
	type?: string;
	technology?: string;
}

export interface EdgeData {
	id?: string;
	source: string;
	target: string;
	label?: string;
	description?: string;
	technology?: string;
}

/**
 * Find a node in the YAML document by its id (searches recursively through children)
 */
function findNodeInSeq(seq: YAMLSeq, nodeId: string): { node: YAMLMap; parent: YAMLSeq; index: number } | null {
	for (let i = 0; i < seq.items.length; i++) {
		const item = seq.items[i];
		if (isMap(item)) {
			const id = item.get('id');
			if (id === nodeId) {
				return { node: item, parent: seq, index: i };
			}
			// Check children recursively
			const children = item.get('children');
			if (isSeq(children)) {
				const found = findNodeInSeq(children, nodeId);
				if (found) return found;
			}
		}
	}
	return null;
}

/**
 * Find a node's parent container id by searching the tree
 */
function findNodeParent(seq: YAMLSeq, nodeId: string, parentId?: string): string | undefined {
	for (let i = 0; i < seq.items.length; i++) {
		const item = seq.items[i];
		if (isMap(item)) {
			const id = item.get('id') as string;
			if (id === nodeId) {
				return parentId;
			}
			const children = item.get('children');
			if (isSeq(children)) {
				const found = findNodeParent(children, nodeId, id);
				if (found !== undefined || found === undefined && findNodeInSeq(children, nodeId)) {
					return found ?? id;
				}
			}
		}
	}
	return undefined;
}

/**
 * Update a node's label in the YAML document
 */
export function updateNodeLabel(yamlText: string, nodeId: string, newLabel: string): string {
	const doc = parseDocument(yamlText);
	const nodes = doc.get('nodes');

	if (!isSeq(nodes)) return yamlText;

	const found = findNodeInSeq(nodes, nodeId);
	if (found) {
		found.node.set('label', newLabel);
	}

	return doc.toString();
}

/**
 * Delete a node from the YAML document
 */
export function deleteNode(yamlText: string, nodeId: string): string {
	const doc = parseDocument(yamlText);
	const nodes = doc.get('nodes');

	if (!isSeq(nodes)) return yamlText;

	const found = findNodeInSeq(nodes, nodeId);
	if (found) {
		found.parent.items.splice(found.index, 1);
	}

	// Also remove any edges that reference this node
	const edges = doc.get('edges');
	if (isSeq(edges)) {
		for (let i = edges.items.length - 1; i >= 0; i--) {
			const edge = edges.items[i];
			if (isMap(edge)) {
				const source = edge.get('source');
				const target = edge.get('target');
				if (source === nodeId || target === nodeId) {
					edges.items.splice(i, 1);
				}
			}
		}
	}

	return doc.toString();
}

/**
 * Add a new node to the YAML document
 */
export function addNode(yamlText: string, node: NodeData, parentId?: string): string {
	const doc = parseDocument(yamlText);
	const nodes = doc.get('nodes');

	if (!isSeq(nodes)) {
		// Create nodes array if it doesn't exist
		doc.set('nodes', []);
	}

	const newNode = doc.createNode({
		id: node.id,
		label: node.label,
		...(node.description && { description: node.description }),
		...(node.type && { type: node.type }),
		...(node.technology && { technology: node.technology })
	});

	if (parentId) {
		// Add as child of parent
		const nodesSeq = doc.get('nodes') as YAMLSeq;
		const parentFound = findNodeInSeq(nodesSeq, parentId);
		if (parentFound) {
			let children = parentFound.node.get('children');
			if (!isSeq(children)) {
				parentFound.node.set('children', []);
				children = parentFound.node.get('children') as YAMLSeq;
			}
			(children as YAMLSeq).add(newNode);
		}
	} else {
		// Add to root nodes
		(doc.get('nodes') as YAMLSeq).add(newNode);
	}

	return doc.toString();
}

/**
 * Delete an edge from the YAML document
 */
export function deleteEdge(yamlText: string, edgeId: string): string {
	const doc = parseDocument(yamlText);
	const edges = doc.get('edges');

	if (!isSeq(edges)) return yamlText;

	for (let i = 0; i < edges.items.length; i++) {
		const edge = edges.items[i];
		if (isMap(edge)) {
			// Check by id or by source-target combination
			const id = edge.get('id');
			const source = edge.get('source');
			const target = edge.get('target');
			const computedId = id || `${source}-${target}`;

			if (computedId === edgeId) {
				edges.items.splice(i, 1);
				break;
			}
		}
	}

	return doc.toString();
}

/**
 * Add a new edge to the YAML document
 */
export function addEdge(yamlText: string, edge: EdgeData): string {
	const doc = parseDocument(yamlText);
	let edges = doc.get('edges');

	if (!isSeq(edges)) {
		doc.set('edges', []);
		edges = doc.get('edges');
	}

	const newEdge = doc.createNode({
		source: edge.source,
		target: edge.target,
		...(edge.label && { label: edge.label }),
		...(edge.description && { description: edge.description }),
		...(edge.technology && { technology: edge.technology })
	});

	(edges as YAMLSeq).add(newEdge);

	return doc.toString();
}

/**
 * Move a node to a new parent (for reparenting via drag)
 */
export function reparentNode(yamlText: string, nodeId: string, newParentId: string | null): string {
	const doc = parseDocument(yamlText);
	const nodes = doc.get('nodes');

	if (!isSeq(nodes)) return yamlText;

	// Find and remove the node from its current location
	const found = findNodeInSeq(nodes, nodeId);
	if (!found) return yamlText;

	// Clone the node data before removing
	const nodeData = found.node.toJSON();
	found.parent.items.splice(found.index, 1);

	// Create new node from the data
	const newNode = doc.createNode(nodeData);

	if (newParentId) {
		// Add to new parent's children
		const newParentFound = findNodeInSeq(nodes, newParentId);
		if (newParentFound) {
			let children = newParentFound.node.get('children');
			if (!isSeq(children)) {
				newParentFound.node.set('children', []);
				children = newParentFound.node.get('children') as YAMLSeq;
			}
			(children as YAMLSeq).add(newNode);
		}
	} else {
		// Move to root level
		(doc.get('nodes') as YAMLSeq).add(newNode);
	}

	return doc.toString();
}

/**
 * Update a node's properties (label, description, type, technology)
 */
export function updateNodeProperties(yamlText: string, nodeId: string, props: Partial<NodeData>): string {
	const doc = parseDocument(yamlText);
	const nodes = doc.get('nodes');

	if (!isSeq(nodes)) return yamlText;

	const found = findNodeInSeq(nodes, nodeId);
	if (found) {
		if (props.label !== undefined) found.node.set('label', props.label);
		if (props.description !== undefined) found.node.set('description', props.description);
		if (props.type !== undefined) found.node.set('type', props.type);
		if (props.technology !== undefined) found.node.set('technology', props.technology);
	}

	return doc.toString();
}

/**
 * Update an edge's label
 */
export function updateEdgeLabel(yamlText: string, edgeId: string, newLabel: string): string {
	const doc = parseDocument(yamlText);
	const edges = doc.get('edges');

	if (!isSeq(edges)) return yamlText;

	for (let i = 0; i < edges.items.length; i++) {
		const edge = edges.items[i];
		if (isMap(edge)) {
			const id = edge.get('id');
			const source = edge.get('source');
			const target = edge.get('target');
			const computedId = id || `${source}-${target}`;

			if (computedId === edgeId) {
				edge.set('label', newLabel);
				break;
			}
		}
	}

	return doc.toString();
}

/**
 * Generate a unique node ID based on a label
 */
export function generateNodeId(label: string, existingIds: Set<string>): string {
	const baseId = label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		|| 'node';

	let id = baseId;
	let counter = 1;
	while (existingIds.has(id)) {
		id = `${baseId}_${counter}`;
		counter++;
	}

	return id;
}

/**
 * Get all node IDs from the current diagram
 */
export function getAllNodeIds(yamlText: string): Set<string> {
	const ids = new Set<string>();

	try {
		const doc = parseDocument(yamlText);
		const nodes = doc.get('nodes');

		if (isSeq(nodes)) {
			collectIds(nodes, ids);
		}
	} catch {
		// Return empty set on parse error
	}

	return ids;
}

function collectIds(seq: YAMLSeq, ids: Set<string>): void {
	for (const item of seq.items) {
		if (isMap(item)) {
			const id = item.get('id');
			if (typeof id === 'string') {
				ids.add(id);
			}
			const children = item.get('children');
			if (isSeq(children)) {
				collectIds(children, ids);
			}
		}
	}
}
