// Void's ContextGatheringService adapted for our Electron environment
// Original: void/src/vs/workbench/contrib/void/browser/contextGatheringService.ts

export interface IContextGatheringService {
	readonly _serviceBrand: undefined;
	updateCache(model: any, pos: any): Promise<void>;
	getCachedSnippets(): string[];
}

export interface IContextManagementService {
	readonly _serviceBrand: undefined;
	updateCache(model: any, pos: any): Promise<void>;
	getCachedSnippets(): string[];
}

export const IContextGatheringService = { _serviceBrand: undefined };
export const IContextManagementService = { _serviceBrand: undefined };

class ContextGatheringService {
	private readonly _NUM_LINES = 3;
	private readonly _MAX_SNIPPET_LINES = 7;  // Reasonable size for context
	// Cache holds the most recent list of snippets.
	private _cache: string[] = [];
	private _snippetIntervals: any[] = [];

	constructor() {
		// Initialize without VS Code dependencies
	}

	public async updateCache(model: any, pos: any): Promise<void> {
		const snippets = new Set<string>();
		this._snippetIntervals = []; // Reset intervals for new cache update

		await this._gatherNearbySnippets(model, pos, this._NUM_LINES, 3, snippets, this._snippetIntervals);
		await this._gatherParentSnippets(model, pos, this._NUM_LINES, 3, snippets, this._snippetIntervals);

		// Convert to array and filter overlapping snippets
		this._cache = Array.from(snippets);
		console.log('Cache updated:', this._cache);
	}

	public getCachedSnippets(): string[] {
		return this._cache;
	}

	// Basic snippet extraction.
	private _getSnippetForRange(model: any, range: any, numLines: number): string {
		const startLine = Math.max(range.startLineNumber - numLines, 1);
		const endLine = Math.min(range.endLineNumber + numLines, model.getLineCount());

		// Enforce maximum snippet size
		const totalLines = endLine - startLine + 1;
		const adjustedStartLine = totalLines > this._MAX_SNIPPET_LINES
			? endLine - this._MAX_SNIPPET_LINES + 1
			: startLine;

		const snippetRange = { startLine: adjustedStartLine, endLine };
		return this._cleanSnippet(this._getValueInRange(model, snippetRange));
	}

	private _getValueInRange(model: any, range: any): string {
		// Simplified version for our environment
		const lines = model.getLinesContent ? model.getLinesContent() : [];
		if (lines.length === 0) return '';
		
		const start = Math.max(0, range.startLine - 1);
		const end = Math.min(lines.length, range.endLine);
		return lines.slice(start, end).join('\n');
	}

	private _cleanSnippet(snippet: string): string {
		return snippet
			.split('\n')
			// Remove empty lines and lines with only comments
			.filter(line => {
				const trimmed = line.trim();
				return trimmed && !/^\/\/+$/.test(trimmed);
			})
			// Rejoin with newlines
			.join('\n')
			// Remove excess whitespace
			.trim();
	}

	private _normalizeSnippet(snippet: string): string {
		return snippet
			// Remove multiple newlines
			.replace(/\n{2,}/g, '\n')
			// Remove trailing whitespace
			.trim();
	}

	private _addSnippetIfNotOverlapping(
		model: any,
		range: any,
		snippets: Set<string>,
		visited: any[]
	): void {
		const startLine = range.startLineNumber;
		const endLine = range.endLineNumber;
		const uri = model.uri ? model.uri.toString() : 'unknown';

		if (!this._isRangeVisited(uri, startLine, endLine, visited)) {
			visited.push({ uri, startLine, endLine });
			const snippet = this._normalizeSnippet(this._getSnippetForRange(model, range, this._NUM_LINES));
			if (snippet.length > 0) {
				snippets.add(snippet);
			}
		}
	}

	private async _gatherNearbySnippets(
		model: any,
		pos: any,
		numLines: number,
		depth: number,
		snippets: Set<string>,
		visited: any[]
	): Promise<void> {
		if (depth <= 0) return;

		const startLine = Math.max(pos.lineNumber - numLines, 1);
		const endLine = Math.min(pos.lineNumber + numLines, model.getLineCount ? model.getLineCount() : 1);
		const range = { startLineNumber: startLine, endLineNumber: endLine };

		this._addSnippetIfNotOverlapping(model, range, snippets, visited);

		// Simplified symbol gathering for our environment
		const symbols = await this._getSymbolsNearPosition(model, pos, numLines);
		for (const sym of symbols) {
			const defs = await this._getDefinitionSymbols(model, sym);
			for (const def of defs) {
				const defModel = this._getModel(def.uri);
				if (defModel) {
					const defPos = { lineNumber: def.range.startLineNumber, column: def.range.startColumn };
					this._addSnippetIfNotOverlapping(defModel, def.range, snippets, visited);
					await this._gatherNearbySnippets(defModel, defPos, numLines, depth - 1, snippets, visited);
				}
			}
		}
	}

	private async _gatherParentSnippets(
		model: any,
		pos: any,
		numLines: number,
		depth: number,
		snippets: Set<string>,
		visited: any[]
	): Promise<void> {
		if (depth <= 0) return;

		const container = await this._findContainerFunction(model, pos);
		if (!container) return;

		const containerRange = container.kind === 'method' ? container.selectionRange : container.range;
		this._addSnippetIfNotOverlapping(model, containerRange, snippets, visited);

		const symbols = await this._getSymbolsNearRange(model, containerRange, numLines);
		for (const sym of symbols) {
			const defs = await this._getDefinitionSymbols(model, sym);
			for (const def of defs) {
				const defModel = this._getModel(def.uri);
				if (defModel) {
					const defPos = { lineNumber: def.range.startLineNumber, column: def.range.startColumn };
					this._addSnippetIfNotOverlapping(defModel, def.range, snippets, visited);
					await this._gatherNearbySnippets(defModel, defPos, numLines, depth - 1, snippets, visited);
				}
			}
		}

		const containerPos = { lineNumber: containerRange.startLineNumber, column: containerRange.startColumn };
		await this._gatherParentSnippets(model, containerPos, numLines, depth - 1, snippets, visited);
	}

	private _isRangeVisited(uri: string, startLine: number, endLine: number, visited: any[]): boolean {
		return visited.some(interval =>
			interval.uri === uri &&
			!(endLine < interval.startLine || startLine > interval.endLine)
		);
	}

	private async _getSymbolsNearPosition(model: any, pos: any, numLines: number): Promise<any[]> {
		const startLine = Math.max(pos.lineNumber - numLines, 1);
		const endLine = Math.min(pos.lineNumber + numLines, model.getLineCount ? model.getLineCount() : 1);
		const range = { startLineNumber: startLine, endLineNumber: endLine };
		return this._getSymbolsInRange(model, range);
	}

	private async _getSymbolsNearRange(model: any, range: any, numLines: number): Promise<any[]> {
		const centerLine = Math.floor((range.startLineNumber + range.endLineNumber) / 2);
		const startLine = Math.max(centerLine - numLines, 1);
		const endLine = Math.min(centerLine + numLines, model.getLineCount ? model.getLineCount() : 1);
		const searchRange = { startLineNumber: startLine, endLineNumber: endLine };
		return this._getSymbolsInRange(model, searchRange);
	}

	private async _getSymbolsInRange(model: any, range: any): Promise<any[]> {
		// Simplified symbol detection for our environment
		const symbols: any[] = [];
		
		// Basic symbol detection based on content
		const lines = model.getLinesContent ? model.getLinesContent() : [];
		for (let line = range.startLineNumber; line <= range.endLineNumber && line <= lines.length; line++) {
			const content = lines[line - 1] || '';
			const words = content.match(/[a-zA-Z_]\w*/g) || [];
			for (const word of words) {
				if (word.length > 2) { // Only consider meaningful symbols
					symbols.push({
						name: word,
						detail: '',
						kind: 'variable',
						range: { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: content.length + 1 },
						selectionRange: { startLineNumber: line, endLineNumber: line, startColumn: 1, endColumn: content.length + 1 },
						children: [],
						tags: []
					});
				}
			}
		}
		
		return symbols;
	}

	private _getModel(uri: any): any {
		// Simplified model retrieval for our environment
		return { uri, getLineCount: () => 1, getLinesContent: () => [''] };
	}

	private async _getDefinitionSymbols(model: any, symbol: any): Promise<any[]> {
		// Simplified definition detection for our environment
		return [{
			name: symbol.name,
			detail: symbol.detail,
			kind: symbol.kind,
			range: symbol.range,
			selectionRange: symbol.range,
			children: [],
			tags: symbol.tags || [],
			uri: model.uri || 'unknown'
		}];
	}

	private async _findContainerFunction(model: any, pos: any): Promise<any | null> {
		// Simplified container function detection for our environment
		const searchRange = {
			startLineNumber: Math.max(pos.lineNumber - 1, 1),
			endLineNumber: Math.min(pos.lineNumber + 1, model.getLineCount ? model.getLineCount() : 1)
		};
		
		const symbols = await this._getSymbolsInRange(model, searchRange);
		const funcs = symbols.filter(s =>
			(s.kind === 'function' || s.kind === 'method') &&
			this._positionInRange(pos, s.range)
		);
		
		if (!funcs.length) return null;
		return funcs.reduce((innermost, current) => {
			if (!innermost) return current;
			const moreInner =
				(current.range.startLineNumber > innermost.range.startLineNumber ||
					(current.range.startLineNumber === innermost.range.startLineNumber &&
						current.range.startColumn > innermost.range.startColumn)) &&
				(current.range.endLineNumber < innermost.range.endLineNumber ||
					(current.range.endLineNumber === innermost.range.endLineNumber &&
						current.range.endColumn < innermost.range.endColumn));
			return moreInner ? current : innermost;
		}, null as any);
	}

	private _positionInRange(pos: any, range: any): boolean {
		return pos.lineNumber >= range.startLineNumber &&
			pos.lineNumber <= range.endLineNumber &&
			(pos.lineNumber !== range.startLineNumber || pos.column >= range.startColumn) &&
			(pos.lineNumber !== range.endLineNumber || pos.column <= range.endColumn);
	}
}

// Export the class directly for use in our system
export { ContextGatheringService };
export const ContextManagementService = ContextGatheringService;
