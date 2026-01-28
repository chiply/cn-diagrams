declare module 'cytoscape-fcose' {
	import cytoscape from 'cytoscape';

	const fcose: cytoscape.Ext;
	export = fcose;

	namespace fcose {
		interface FcoseLayoutOptions extends cytoscape.BaseLayoutOptions {
			name: 'fcose';
			quality?: 'draft' | 'default' | 'proof';
			randomize?: boolean;
			animate?: boolean;
			animationDuration?: number;
			animationEasing?: string;
			fit?: boolean;
			padding?: number;
			nodeDimensionsIncludeLabels?: boolean;
			uniformNodeDimensions?: boolean;
			packComponents?: boolean;
			step?: 'all' | 'transformed' | 'enforced' | 'cose' | 'incremental';
			samplingType?: boolean;
			sampleSize?: number;
			nodeSeparation?: number;
			piTol?: number;
			nodeRepulsion?: number | ((node: any) => number);
			idealEdgeLength?: number | ((edge: any) => number);
			edgeElasticity?: number | ((edge: any) => number);
			nestingFactor?: number;
			numIter?: number;
			tile?: boolean;
			tilingPaddingVertical?: number;
			tilingPaddingHorizontal?: number;
			gravity?: number;
			gravityRangeCompound?: number;
			gravityCompound?: number;
			gravityRange?: number;
			initialEnergyOnIncremental?: number;
		}
	}
}
