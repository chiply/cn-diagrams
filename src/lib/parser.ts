// CN DSL Parser - YAML Format
// Parses YAML-based diagram definitions for maximum intellisense support

import { parse } from 'yaml';

// YAML Schema Types - using many fields for better intellisense/validation

export interface YAMLNode {
	id: string;
	label: string;
	description?: string;
	type?: string;
	technology?: string;
	children?: YAMLNode[];
}

export interface YAMLEdge {
	id?: string;
	source: string;
	target: string;
	label?: string;
	description?: string;
	technology?: string;
	style?: 'solid' | 'dashed' | 'dotted';
}

export interface YAMLDiagram {
	name?: string;
	description?: string;
	nodes: YAMLNode[];
	edges?: YAMLEdge[];
}

// Internal types for Cytoscape conversion

export interface CNNode {
	id: string;
	label: string;
	parent?: string;
	description?: string;
	type?: string;
	technology?: string;
}

export interface CNEdge {
	id: string;
	source: string;
	target: string;
	label?: string;
	description?: string;
	technology?: string;
	style?: string;
}

export interface CNDiagram {
	name?: string;
	description?: string;
	nodes: CNNode[];
	edges: CNEdge[];
	errors: string[];
}

function flattenNodes(nodes: YAMLNode[], parentId?: string): CNNode[] {
	const result: CNNode[] = [];

	for (const node of nodes) {
		result.push({
			id: node.id,
			label: node.label,
			parent: parentId,
			description: node.description,
			type: node.type,
			technology: node.technology
		});

		if (node.children && node.children.length > 0) {
			result.push(...flattenNodes(node.children, node.id));
		}
	}

	return result;
}

export function parseCNDSL(input: string): CNDiagram {
	const errors: string[] = [];

	try {
		const doc = parse(input) as YAMLDiagram | null;

		if (!doc) {
			return { nodes: [], edges: [], errors: ['Empty document'] };
		}

		if (!doc.nodes || !Array.isArray(doc.nodes)) {
			return { nodes: [], edges: [], errors: ['Missing or invalid "nodes" array'] };
		}

		// Flatten nested nodes
		const nodes = flattenNodes(doc.nodes);

		// Process edges
		const edges: CNEdge[] = [];
		if (doc.edges && Array.isArray(doc.edges)) {
			for (let i = 0; i < doc.edges.length; i++) {
				const edge = doc.edges[i];
				if (!edge.source || !edge.target) {
					errors.push(`Edge ${i + 1}: Missing source or target`);
					continue;
				}
				edges.push({
					id: edge.id || `${edge.source}-${edge.target}`,
					source: edge.source,
					target: edge.target,
					label: edge.label,
					description: edge.description,
					technology: edge.technology,
					style: edge.style
				});
			}
		}

		return {
			name: doc.name,
			description: doc.description,
			nodes,
			edges,
			errors
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown parsing error';
		return { nodes: [], edges: [], errors: [message] };
	}
}

// Truncate text to a maximum length with ellipsis
function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 1).trim() + '…';
}

// Build a display label that includes technology and truncated description
function buildDisplayLabel(node: CNNode): string {
	const lines: string[] = [node.label];

	if (node.technology) {
		lines.push(`[${node.technology}]`);
	}

	if (node.description) {
		lines.push(truncate(node.description, 40));
	}

	return lines.join('\n');
}

// Convert CN diagram to Cytoscape elements
export function toCytoscapeElements(diagram: CNDiagram): cytoscape.ElementDefinition[] {
	const elements: cytoscape.ElementDefinition[] = [];

	// Add nodes
	for (const node of diagram.nodes) {
		elements.push({
			group: 'nodes',
			data: {
				id: node.id,
				label: node.label,
				displayLabel: buildDisplayLabel(node),
				parent: node.parent,
				description: node.description,
				type: node.type,
				technology: node.technology
			}
		});
	}

	// Add edges
	for (const edge of diagram.edges) {
		// Build edge display label including technology
		let edgeDisplayLabel = edge.label || '';
		if (edge.technology) {
			edgeDisplayLabel += edgeDisplayLabel ? ` [${edge.technology}]` : `[${edge.technology}]`;
		}

		elements.push({
			group: 'edges',
			data: {
				id: edge.id,
				source: edge.source,
				target: edge.target,
				label: edge.label || '',
				displayLabel: edgeDisplayLabel,
				description: edge.description,
				technology: edge.technology,
				style: edge.style
			}
		});
	}

	return elements;
}
