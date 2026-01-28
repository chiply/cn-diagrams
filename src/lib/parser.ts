// CN DSL Parser
// DSL Syntax:
//   # Comment
//   node <id> "<label>" { ... nested nodes ... }
//   edge <source> -> <target> "<label>"

export interface CNNode {
	id: string;
	label: string;
	parent?: string;
}

export interface CNEdge {
	source: string;
	target: string;
	label?: string;
}

export interface CNDiagram {
	nodes: CNNode[];
	edges: CNEdge[];
	errors: string[];
}

interface ParseContext {
	parentId?: string;
	nodes: CNNode[];
	edges: CNEdge[];
	errors: string[];
}

export function parseCNDSL(input: string): CNDiagram {
	const context: ParseContext = {
		nodes: [],
		edges: [],
		errors: []
	};

	const lines = input.split('\n');
	let i = 0;

	function parseBlock(parentId?: string): void {
		while (i < lines.length) {
			const line = lines[i].trim();

			// Skip empty lines and comments
			if (!line || line.startsWith('#')) {
				i++;
				continue;
			}

			// End of block
			if (line === '}') {
				i++;
				return;
			}

			// Parse node
			const nodeMatch = line.match(/^node\s+(\w+)\s+"([^"]*)"(\s*\{)?$/);
			if (nodeMatch) {
				const [, id, label, hasChildren] = nodeMatch;
				context.nodes.push({
					id,
					label,
					parent: parentId
				});
				i++;

				if (hasChildren) {
					parseBlock(id);
				}
				continue;
			}

			// Parse edge
			const edgeMatch = line.match(/^edge\s+(\w+)\s*->\s*(\w+)(?:\s+"([^"]*)")?$/);
			if (edgeMatch) {
				const [, source, target, label] = edgeMatch;
				context.edges.push({
					source,
					target,
					label
				});
				i++;
				continue;
			}

			// Unknown line
			context.errors.push(`Line ${i + 1}: Unable to parse "${line}"`);
			i++;
		}
	}

	parseBlock();

	return {
		nodes: context.nodes,
		edges: context.edges,
		errors: context.errors
	};
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
				parent: node.parent
			}
		});
	}

	// Add edges
	for (const edge of diagram.edges) {
		elements.push({
			group: 'edges',
			data: {
				id: `${edge.source}-${edge.target}`,
				source: edge.source,
				target: edge.target,
				label: edge.label || ''
			}
		});
	}

	return elements;
}
