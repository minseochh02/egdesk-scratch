/**
 * Service for handling search-replace component positioning
 *
 * This service ensures that search-replace blocks are positioned immediately
 * after the text elements they are meant to modify, not after code blocks.
 */

interface SearchReplaceBlock {
  content: string;
  start: number;
  end: number;
  searchText: string;
  replaceText: string;
  filePath?: string;
}

interface TextElement {
  content: string;
  start: number;
  end: number;
  type: 'paragraph' | 'codeblock' | 'search-replace';
}

interface PositioningResult {
  before: string;
  after: string;
  searchReplaceBlocks: SearchReplaceBlock[];
}

export class SearchReplacePositioningService {
  private static instance: SearchReplacePositioningService;

  public static getInstance(): SearchReplacePositioningService {
    if (!SearchReplacePositioningService.instance) {
      SearchReplacePositioningService.instance =
        new SearchReplacePositioningService();
    }
    return SearchReplacePositioningService.instance;
  }

  /**
   * Analyzes text and applies search-replace operations, removing the blocks after replacement
   */
  public repositionSearchReplaceBlocks(text: string): PositioningResult {
    console.log(
      '🔍 SearchReplacePositioningService: Starting text replacement analysis',
    );

    // Step 1: Extract all search-replace blocks
    const searchReplaceBlocks = this.extractSearchReplaceBlocks(text);
    console.log(`🔍 Found ${searchReplaceBlocks.length} search-replace blocks`);

    if (searchReplaceBlocks.length === 0) {
      // No search-replace blocks, return original split
      return this.defaultSplit(text);
    }

    // Step 2: Apply replacements to the text and remove search-replace blocks
    const processedText = this.applyReplacements(text, searchReplaceBlocks);

    // Step 3: Split the processed text naturally
    const result = this.defaultSplit(processedText);

    console.log(
      '🔍 SearchReplacePositioningService: Text replacement complete',
    );
    return {
      ...result,
      searchReplaceBlocks, // Keep track of what was replaced for debugging
    };
  }

  /**
   * Apply all search-replace operations to the text and remove the blocks
   */
  private applyReplacements(
    text: string,
    searchReplaceBlocks: SearchReplaceBlock[],
  ): string {
    console.log('🔍 Applying replacements to text');
    let processedText = text;

    // Sort blocks by their position in reverse order to maintain indices when removing
    const sortedBlocks = [...searchReplaceBlocks].sort(
      (a, b) => b.start - a.start,
    );

    for (const block of sortedBlocks) {
      console.log(
        `🔍 Applying replacement: "${block.searchText}" -> "${block.replaceText}"`,
      );

      // First, remove the search-replace block from the text
      processedText =
        processedText.substring(0, block.start) +
        processedText.substring(block.end);

      // Then, find and replace the search text with replace text
      if (block.searchText && block.replaceText) {
        const searchTextTrimmed = block.searchText.trim();
        const replaceTextTrimmed = block.replaceText.trim();

        if (processedText.includes(searchTextTrimmed)) {
          processedText = processedText.replace(
            searchTextTrimmed,
            replaceTextTrimmed,
          );
          console.log(
            `✅ Successfully replaced text: "${searchTextTrimmed}" -> "${replaceTextTrimmed}"`,
          );
        } else {
          console.log(
            `⚠️ Search text not found in content: "${searchTextTrimmed}"`,
          );
          // Try to find partial matches or similar text
          const lines = processedText.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (
              lines[i].trim().includes(searchTextTrimmed) ||
              searchTextTrimmed.includes(lines[i].trim())
            ) {
              lines[i] = lines[i].replace(lines[i].trim(), replaceTextTrimmed);
              processedText = lines.join('\n');
              console.log(
                `✅ Found and replaced similar text on line ${i + 1}`,
              );
              break;
            }
          }
        }
      }
    }

    // Clean up any extra whitespace that might have been left behind
    processedText = processedText.replace(/\n\n\n+/g, '\n\n').trim();

    console.log('🔍 Replacement complete');
    return processedText;
  }

  /**
   * Extract all search-replace blocks from the text
   */
  private extractSearchReplaceBlocks(text: string): SearchReplaceBlock[] {
    const blocks: SearchReplaceBlock[] = [];
    const regex = /```search-replace[\s\S]*?```/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const content = match[0];
      const start = match.index!;
      const end = start + content.length;

      // Parse the block content to extract search and replace text
      const { searchText, replaceText, filePath } =
        this.parseSearchReplaceContent(content);

      blocks.push({
        content,
        start,
        end,
        searchText,
        replaceText,
        filePath,
      });
    }

    return blocks;
  }

  /**
   * Parse search-replace block content to extract search/replace text
   */
  private parseSearchReplaceContent(content: string): {
    searchText: string;
    replaceText: string;
    filePath?: string;
  } {
    // Try new format with LINES field first
    const newFormatRegex =
      /```search-replace\s*\nFILE:\s*(.+?)\s*\nLINES:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/;
    let match = newFormatRegex.exec(content);

    if (match) {
      return {
        searchText: match[3].trim(),
        replaceText: match[4].trim(),
        filePath: match[1].trim(),
      };
    }

    // Try old format without LINES
    const oldFormatRegex =
      /```search-replace\s*\nFILE:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/;
    match = oldFormatRegex.exec(content);

    if (match) {
      return {
        searchText: match[2].trim(),
        replaceText: match[3].trim(),
        filePath: match[1].trim(),
      };
    }

    return { searchText: '', replaceText: '' };
  }

  /**
   * Remove search-replace blocks from text temporarily
   */
  private removeSearchReplaceBlocks(
    text: string,
    blocks: SearchReplaceBlock[],
  ): string {
    let result = text;
    // Remove blocks in reverse order to maintain indices
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      result = result.substring(0, block.start) + result.substring(block.end);
    }
    return result;
  }

  /**
   * Parse text into elements (paragraphs, code blocks, etc.)
   */
  private parseTextElements(text: string): TextElement[] {
    const elements: TextElement[] = [];

    // First, find all code blocks (non-search-replace)
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks: Array<{ start: number; end: number }> = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      codeBlocks.push({
        start: match.index!,
        end: match.index! + match[0].length,
      });
    }

    // Split text into paragraphs, considering code blocks
    let currentIndex = 0;
    const paragraphs = text.split('\n\n');

    for (const paragraph of paragraphs) {
      if (paragraph.trim().length > 0) {
        const paragraphStart = text.indexOf(paragraph, currentIndex);
        const paragraphEnd = paragraphStart + paragraph.length;

        // Check if this is within a code block
        const isCodeBlock = codeBlocks.some(
          (block) => paragraphStart >= block.start && paragraphEnd <= block.end,
        );

        elements.push({
          content: paragraph,
          start: paragraphStart,
          end: paragraphEnd,
          type: isCodeBlock ? 'codeblock' : 'paragraph',
        });

        currentIndex = paragraphEnd;
      }
    }

    return elements.sort((a, b) => a.start - b.start);
  }

  /**
   * Find the target text element for each search-replace block
   */
  private findTargetTextElements(
    searchReplaceBlocks: SearchReplaceBlock[],
    textElements: TextElement[],
    originalText: string,
  ): Array<SearchReplaceBlock & { targetElementIndex: number }> {
    return searchReplaceBlocks.map((block) => {
      console.log(
        `🔍 Finding target for search-replace block: "${block.searchText.substring(0, 50)}..."`,
      );

      let bestTargetIndex = -1;
      let bestScore = 0;

      // Look for the text element that best matches what this search-replace block is targeting
      for (let i = 0; i < textElements.length; i++) {
        const element = textElements[i];

        // Skip code blocks - we want to position after text elements, not code blocks
        if (element.type === 'codeblock') {
          continue;
        }

        let score = 0;
        const elementText = element.content.toLowerCase();

        // Score based on content relevance
        if (elementText.includes('sentence')) score += 5;
        if (elementText.includes('text')) score += 3;
        if (elementText.includes('content')) score += 3;
        if (elementText.includes('element')) score += 3;
        if (elementText.includes('modify')) score += 4;
        if (elementText.includes('change')) score += 4;
        if (elementText.includes('replace')) score += 4;
        if (elementText.includes('second')) score += 3; // For "second sentence" example

        // Score based on search text content matching
        if (block.searchText.length > 5) {
          const searchWords = block.searchText
            .toLowerCase()
            .split(/\s+/)
            .filter((word) => word.length > 2);
          const elementWords = elementText.split(/\s+/);
          const matchingWords = searchWords.filter((word) =>
            elementWords.some(
              (elementWord) =>
                elementWord.includes(word) || word.includes(elementWord),
            ),
          );
          score += matchingWords.length * 3;
        }

        // Prefer elements that are closer to where the search-replace block originally appeared
        const originalBlockPosition = block.start;
        const distanceFromBlock = Math.abs(
          element.start - originalBlockPosition,
        );
        const maxDistance = originalText.length;
        const proximityScore = Math.max(
          0,
          2 - (distanceFromBlock / maxDistance) * 2,
        );
        score += proximityScore;

        // Prefer substantial paragraphs
        if (element.content.trim().length > 20) score += 1;
        if (element.content.trim().length > 50) score += 1;

        console.log(
          `🔍 Element ${i} ("${element.content.substring(0, 30)}..."): score = ${score}`,
        );

        if (score > bestScore) {
          bestScore = score;
          bestTargetIndex = i;
        }
      }

      console.log(
        `🔍 Best target for search-replace block: element ${bestTargetIndex} (score: ${bestScore})`,
      );

      return {
        ...block,
        targetElementIndex: bestTargetIndex,
      };
    });
  }

  /**
   * Reconstruct text with properly positioned search-replace blocks
   */
  private reconstructText(
    textElements: TextElement[],
    repositionedBlocks: Array<
      SearchReplaceBlock & { targetElementIndex: number }
    >,
  ): PositioningResult {
    let beforeText = '';
    let afterText = '';
    let splitFound = false;

    // Group blocks by their target elements
    const blocksByTarget = new Map<number, SearchReplaceBlock[]>();
    repositionedBlocks.forEach((block) => {
      if (block.targetElementIndex >= 0) {
        const existing = blocksByTarget.get(block.targetElementIndex) || [];
        existing.push(block);
        blocksByTarget.set(block.targetElementIndex, existing);
      }
    });

    // Reconstruct text, placing search-replace blocks after their target elements
    for (let i = 0; i < textElements.length; i++) {
      const element = textElements[i];
      const elementText = element.content;

      if (!splitFound) {
        beforeText += elementText;

        // Add search-replace blocks that target this element
        const targetedBlocks = blocksByTarget.get(i) || [];
        if (targetedBlocks.length > 0) {
          console.log(
            `🔍 Placing ${targetedBlocks.length} search-replace blocks after element ${i}`,
          );
          for (const block of targetedBlocks) {
            beforeText += `\n\n${block.content}`;
          }
          // This is where we split - after the target element and its search-replace blocks
          splitFound = true;
        } else {
          beforeText += '\n\n';
        }
      } else {
        afterText += `${elementText}\n\n`;
      }
    }

    // If no split was found (no targeted blocks), do a default split
    if (!splitFound) {
      return this.defaultSplit(beforeText + afterText);
    }

    return {
      before: beforeText.trim(),
      after: afterText.trim(),
      searchReplaceBlocks: repositionedBlocks,
    };
  }

  /**
   * Default split when no search-replace blocks are found
   */
  private defaultSplit(text: string): PositioningResult {
    const midPoint = Math.floor(text.length / 2);
    const lastParagraph = text.lastIndexOf('\n\n', midPoint);
    const splitIndex = lastParagraph > 0 ? lastParagraph + 2 : midPoint;

    return {
      before: text.substring(0, splitIndex).trim(),
      after: text.substring(splitIndex).trim(),
      searchReplaceBlocks: [],
    };
  }
}
