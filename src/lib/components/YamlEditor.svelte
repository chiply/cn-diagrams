<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type * as Monaco from 'monaco-editor';

	interface Props {
		value: string;
		onchange?: (value: string) => void;
	}

	let props: Props = $props();

	let container: HTMLDivElement;
	let editor = $state<Monaco.editor.IStandaloneCodeEditor | null>(null);
	let isUpdatingFromProp = false;

	onMount(async () => {
		// Dynamically import Monaco and monaco-yaml (client-side only)
		const monaco = await import('monaco-editor');

		// Set up Monaco environment for workers
		self.MonacoEnvironment = {
			getWorker: async function (_workerId: string, label: string) {
				if (label === 'yaml') {
					const worker = await import('monaco-yaml/yaml.worker?worker');
					return new worker.default();
				}
				const worker = await import('monaco-editor/esm/vs/editor/editor.worker?worker');
				return new worker.default();
			}
		};

		const { configureMonacoYaml } = await import('monaco-yaml');

		// Import the schema
		const schema = await import('$lib/cn-diagram-schema.json');

		// Configure monaco-yaml with our schema
		configureMonacoYaml(monaco, {
			enableSchemaRequest: false,
			schemas: [
				{
					uri: 'https://cn-diagrams.dev/schema.json',
					fileMatch: ['*'],
					schema: schema.default
				}
			]
		});

		// Define a dark theme similar to VS Code's dark theme
		monaco.editor.defineTheme('cn-dark', {
			base: 'vs-dark',
			inherit: true,
			rules: [
				{ token: 'key', foreground: '9CDCFE' },
				{ token: 'string', foreground: 'CE9178' },
				{ token: 'number', foreground: 'B5CEA8' },
				{ token: 'comment', foreground: '6A9955' }
			],
			colors: {
				'editor.background': '#1a202c',
				'editor.foreground': '#e2e8f0',
				'editor.lineHighlightBackground': '#2d3748',
				'editorCursor.foreground': '#e2e8f0',
				'editor.selectionBackground': '#4a5568',
				'editorLineNumber.foreground': '#718096',
				'editorLineNumber.activeForeground': '#a0aec0'
			}
		});

		// Create the editor
		editor = monaco.editor.create(container, {
			value: props.value,
			language: 'yaml',
			theme: 'cn-dark',
			minimap: { enabled: false },
			fontSize: 13,
			fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
			lineHeight: 20,
			padding: { top: 16, bottom: 16 },
			scrollBeyondLastLine: false,
			automaticLayout: true,
			tabSize: 2,
			insertSpaces: true,
			wordWrap: 'on',
			quickSuggestions: {
				other: true,
				comments: false,
				strings: true
			},
			suggestOnTriggerCharacters: true,
			acceptSuggestionOnEnter: 'on',
			formatOnPaste: true,
			formatOnType: true
		});

		// Listen for changes
		editor.onDidChangeModelContent(() => {
			if (isUpdatingFromProp) return;
			const newValue = editor?.getValue() ?? '';
			props.onchange?.(newValue);
		});
	});

	onDestroy(() => {
		editor?.dispose();
	});

	// Update editor when value prop changes externally
	$effect(() => {
		if (editor && props.value !== editor.getValue()) {
			isUpdatingFromProp = true;
			const position = editor.getPosition();
			editor.setValue(props.value);
			if (position) {
				editor.setPosition(position);
			}
			isUpdatingFromProp = false;
		}
	});
</script>

<div class="editor-container" bind:this={container}></div>

<style>
	.editor-container {
		width: 100%;
		height: 100%;
	}
</style>
