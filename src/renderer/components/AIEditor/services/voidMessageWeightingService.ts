// Void's exact message weighting system and 50% output reservation logic
// Copied directly from void/src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts

export interface SimpleLLMMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface WeightedMessage extends SimpleLLMMessage {
	weight: number;
	index: number;
}

export class VoidMessageWeightingService {
	private static readonly CHARS_PER_TOKEN = 4; // Rough estimation
	private static readonly TRIM_TO_LEN = 1000; // Minimum length after trimming
	private static readonly MIN_CHARS_TO_PRESERVE = 5000; // Ensure we don't trim at least 5k chars

	/**
	 * Implements Void's exact 50% output reservation logic
	 */
	static calculateReservedOutputSpace(contextWindow: number, customReservation?: number): number {
		return Math.max(
			contextWindow * 1 / 2, // reserve at least 1/2 of the token window length (Void's approach)
			customReservation ?? 4096 // defaults to 4096 (Void's default)
		);
	}

	/**
	 * Implements Void's exact weighting system
	 * Higher weight = higher priority for trimming
	 */
	static calculateMessageWeight(
		message: SimpleLLMMessage, 
		messages: SimpleLLMMessage[], 
		index: number,
		alreadyTrimmedIndexes: Set<number>
	): number {
		const base = message.content.length;

		let multiplier: number;
		// slow rampdown from 2 to 1 as index increases (Void's exact logic)
		multiplier = 1 + (messages.length - 1 - index) / messages.length;
		
		// Role-based multipliers (Void's exact values)
		if (message.role === 'user') {
			multiplier *= 1; // Normal weight for user messages
		}
		else if (message.role === 'system') {
			multiplier *= 0.01; // Very low weight for system messages
		}
		else {
			multiplier *= 10; // High weight for AI/assistant messages - gets trimmed first
		}

		// Any already modified message should not be trimmed again
		if (alreadyTrimmedIndexes.has(index)) {
			multiplier = 0;
		}
		
		// 1st and last messages should be very low weight (Void's exact logic)
		if (index <= 1 || index >= messages.length - 1 - 3) {
			multiplier *= 0.05;
		}
		
		return base * multiplier;
	}

	/**
	 * Finds the message with the highest weight for trimming
	 * Implements Void's exact `_findLargestByWeight` logic
	 */
	static findLargestByWeight(
		messages: SimpleLLMMessage[], 
		alreadyTrimmedIndexes: Set<number>
	): number {
		let largestIndex = -1;
		let largestWeight = -Infinity;
		
		for (let i = 0; i < messages.length; i += 1) {
			const m = messages[i];
			const w = this.calculateMessageWeight(m, messages, i, alreadyTrimmedIndexes);
			if (w > largestWeight) {
				largestWeight = w;
				largestIndex = i;
			}
		}
		
		return largestIndex;
	}

	/**
	 * Implements Void's exact context window management
	 * Reserves 50% for output and intelligently trims messages
	 */
	static fitMessagesToContextWindow(
		messages: SimpleLLMMessage[],
		contextWindow: number,
		reservedOutputTokenSpace?: number
	): SimpleLLMMessage[] {
		// Calculate reserved space using Void's exact logic
		const reservedOutput = this.calculateReservedOutputSpace(contextWindow, reservedOutputTokenSpace);
		
		// Calculate total length and how much we need to trim
		let totalLen = 0;
		for (const m of messages) { 
			totalLen += m.content.length; 
		}
		
		const charsNeedToTrim = totalLen - Math.max(
			(contextWindow - reservedOutput) * this.CHARS_PER_TOKEN,
			this.MIN_CHARS_TO_PRESERVE
		);

		// If no trimming needed, return as is
		if (charsNeedToTrim <= 0) {
			return messages;
		}

		// Clone messages to avoid modifying originals
		const trimmedMessages = messages.map(m => ({ ...m }));
		const alreadyTrimmedIndexes = new Set<number>();
		let remainingCharsToTrim = charsNeedToTrim;
		let iterationCount = 0;

		// Implement Void's exact trimming loop
		while (remainingCharsToTrim > 0) {
			iterationCount += 1;
			if (iterationCount > 100) break; // Safety limit like Void

			const trimIdx = this.findLargestByWeight(trimmedMessages, alreadyTrimmedIndexes);
			if (trimIdx === -1) break; // No more messages to trim

			const m = trimmedMessages[trimIdx];

			// Calculate how many characters this trim will remove
			const numCharsWillTrim = m.content.length - this.TRIM_TO_LEN;
			
			if (numCharsWillTrim > remainingCharsToTrim) {
				// Trim just the remaining amount needed
				m.content = m.content.slice(0, m.content.length - remainingCharsToTrim - '...'.length).trim() + '...';
				break;
			}

			// Trim to minimum length
			remainingCharsToTrim -= numCharsWillTrim;
			m.content = m.content.substring(0, this.TRIM_TO_LEN - '...'.length) + '...';
			alreadyTrimmedIndexes.add(trimIdx);
		}

		return trimmedMessages;
	}

	/**
	 * Creates a summary of the weighting and trimming process
	 * Useful for debugging and understanding what happened
	 */
	static getWeightingSummary(
		messages: SimpleLLMMessage[],
		contextWindow: number,
		reservedOutputTokenSpace?: number
	): {
		originalLength: number;
		reservedOutput: number;
		availableForContext: number;
		messageWeights: Array<{ index: number; role: string; length: number; weight: number }>;
	} {
		const reservedOutput = this.calculateReservedOutputSpace(contextWindow, reservedOutputTokenSpace);
		const availableForContext = contextWindow - reservedOutput;
		
		const messageWeights = messages.map((message, index) => ({
			index,
			role: message.role,
			length: message.content.length,
			weight: this.calculateMessageWeight(message, messages, index, new Set())
		}));

		return {
			originalLength: messages.reduce((sum, m) => sum + m.content.length, 0),
			reservedOutput,
			availableForContext,
			messageWeights
		};
	}
}
