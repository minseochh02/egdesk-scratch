import { AIEdit } from '../../AIEditor/types';
import { EnhancedAIEditorService } from '../../AIEditor/services/enhancedAIEditorService';

/**
 * Parse search/replace operations from AI response
 */
export const parseSearchReplaceOperations = (content: string, projectRoot: string, normalizePath: (path: string, root: string) => string): AIEdit[] => {
  console.log('🔍 DEBUG: parseSearchReplaceOperations called', {
    contentLength: content.length,
    hasSearchReplaceBlocks: content.includes('```search-replace')
  });
  
  const operations: AIEdit[] = [];
  
  // STRICT APPROACH: Only look for actual ```search-replace blocks
  // First, find all ```search-replace blocks in the content
  const searchReplaceBlockRegex = /```search-replace[\s\S]*?```/g;
  const searchReplaceBlocks: string[] = [];
  let match;
  
  while ((match = searchReplaceBlockRegex.exec(content)) !== null) {
    searchReplaceBlocks.push(match[0]);
  }
  
  console.log('🔍 DEBUG: Found search-replace blocks', {
    count: searchReplaceBlocks.length,
    blocks: searchReplaceBlocks.map(block => ({
      length: block.length,
      preview: block.substring(0, 100)
    }))
  });
  
  // Log the full content of each search-replace block for debugging
  searchReplaceBlocks.forEach((block, index) => {
    console.log(`🔍 DEBUG: Search-replace block ${index + 1}:`, {
      fullContent: block,
      lines: block.split('\n').map((line, i) => `${i + 1}: ${line}`)
    });
  });
  
  // If no search-replace blocks found, return empty array
  if (searchReplaceBlocks.length === 0) {
    console.log('🔍 DEBUG: No search-replace blocks found in content');
    console.log('🔍 DEBUG: Full content for analysis:', {
      contentLength: content.length,
      hasSearchReplaceKeyword: content.includes('search-replace'),
      hasCodeBlocks: content.includes('```'),
      contentPreview: content.substring(0, 500),
      searchReplaceMatches: content.match(/```.*?search.*?replace.*?```/gi) || []
    });
    return operations;
  }
  
  // Process each search-replace block individually
  for (const block of searchReplaceBlocks) {
    console.log('🔍 DEBUG: Processing search-replace block', {
      blockLength: block.length,
      blockPreview: block.substring(0, 200)
    });
    
    // Try new format with LINES field first - create new regex instance each time
    const newFormatRegex = /```search-replace\s*\nFILE:\s*(.+?)\s*\nLINES:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/;
    let match = newFormatRegex.exec(block);
    
    console.log('🔍 DEBUG: Regex matching attempt', {
      block: block,
      regex: newFormatRegex.toString(),
      matchResult: match,
      matchGroups: match ? match.slice(1) : null
    });
    
    if (match) {
      const rawFilePath = match[1].trim();
      const filePath = normalizePath(rawFilePath, projectRoot);
      const linesText = match[2].trim();
      const searchText = match[3].trim();
      const replaceText = match[4].trim();
      
      console.log('🔍 DEBUG: Found search-replace block (new format)', {
        rawFilePath,
        filePath,
        linesText,
        searchTextLength: searchText.length,
        replaceTextLength: replaceText.length,
        searchTextPreview: searchText.substring(0, 100),
        replaceTextPreview: replaceText.substring(0, 100)
      });

      if (filePath && searchText && replaceText) {
        // Parse line numbers (e.g., "15-15" or "10-12")
        let startLine = 1, endLine = 1;
        if (linesText) {
          const lineMatch = linesText.match(/(\d+)-(\d+)/);
          if (lineMatch) {
            const parsedStart = parseInt(lineMatch[1], 10);
            const parsedEnd = parseInt(lineMatch[2], 10);
            // Only use parsed values if they're valid numbers
            if (!isNaN(parsedStart) && !isNaN(parsedEnd)) {
              startLine = parsedStart;
              endLine = parsedEnd;
            }
          }
        }

        console.log('Parsed operation:', { filePath, linesText, startLine, endLine, searchText: searchText.substring(0, 50) });
        
        operations.push({
          type: 'replace' as const,
          filePath: filePath,
          range: {
            start: 0,
            end: 0,
            startLine: startLine,
            endLine: endLine,
            startColumn: 1,
            endColumn: 1
          },
          oldText: searchText,
          newText: replaceText,
          description: `Search and replace in ${filePath} (lines ${startLine}-${endLine})`
        });
      }
    } else {
      // Try old format without LINES - create new regex instance each time
      const oldFormatRegex = /```search-replace\s*\nFILE:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/;
      match = oldFormatRegex.exec(block);
      
      console.log('🔍 DEBUG: Old format regex matching attempt', {
        block: block,
        regex: oldFormatRegex.toString(),
        matchResult: match,
        matchGroups: match ? match.slice(1) : null
      });
      
      if (match) {
        const rawFilePath = match[1].trim();
        const filePath = normalizePath(rawFilePath, projectRoot);
        const searchText = match[2].trim();
        const replaceText = match[3].trim();

        console.log('🔍 DEBUG: Found search-replace block (old format)', {
          rawFilePath,
          filePath,
          searchTextLength: searchText.length,
          replaceTextLength: replaceText.length,
          searchTextPreview: searchText.substring(0, 100),
          replaceTextPreview: replaceText.substring(0, 100)
        });

        if (filePath && searchText && replaceText) {
          operations.push({
            type: 'replace' as const,
            filePath: filePath,
            range: {
              start: 0,
              end: 0,
              startLine: 1,
              endLine: 1,
              startColumn: 1,
              endColumn: 1
            },
            oldText: searchText,
            newText: replaceText,
            description: `Search and replace in ${filePath} (line numbers not specified)`
          });
        }
      } else {
        console.log('🔍 DEBUG: No format matched for search-replace block', {
          block: block,
          blockLines: block.split('\n').map((line, i) => `${i + 1}: ${line}`)
        });
      }
    }
  }

  console.log('🔍 DEBUG: parseSearchReplaceOperations completed', {
    totalOperations: operations.length,
    searchReplaceBlocksFound: searchReplaceBlocks.length,
    operations: operations.map(op => ({
      filePath: op.filePath,
      type: op.type,
      hasOldText: !!op.oldText,
      hasNewText: !!op.newText,
      range: op.range
    }))
  });

  return operations;
};

/**
 * Load file content and generate diff for preview
 */
export const loadFileForEdit = async (
  edit: AIEdit,
  projectContext: { currentProject: any } | undefined,
  onShowDiff?: (filePath: string, diff: { before: string; after: string; lineNumber: number }) => void
) => {
  console.log('🔍 DEBUG: loadFileForEdit called', {
    editFilePath: edit.filePath,
    hasOldText: !!edit.oldText,
    hasNewText: !!edit.newText,
    editType: edit.type,
    editRange: edit.range,
    hasOnShowDiff: !!onShowDiff
  });

  if (!edit.filePath || !edit.oldText || !edit.newText) {
    console.log('❌ DEBUG: loadFileForEdit - Missing required data', { 
      filePath: edit.filePath, 
      oldText: edit.oldText, 
      newText: edit.newText 
    });
    return;
  }

  // Construct the full file path using project context
  const projectPath = projectContext?.currentProject?.path;
  if (!projectPath) {
    console.error('❌ DEBUG: loadFileForEdit - No project context available');
    return;
  }

  // If edit.filePath is already absolute, use it; otherwise construct full path
  const fullFilePath = edit.filePath.startsWith('/') || edit.filePath.startsWith('C:\\') 
    ? edit.filePath 
    : `${projectPath}/${edit.filePath}`;

  console.log('🔍 DEBUG: loadFileForEdit - Starting to load file', {
    originalPath: edit.filePath,
    fullPath: fullFilePath,
    projectPath
  });

  try {
    // Read the current file content using the full path
    let result = await window.electron.fileSystem.readFile(fullFilePath);
    
    // If the file path doesn't work, try some common variations
    if (!result.success) {
      console.log('loadFileForEdit: Original path failed, trying variations');
      const pathVariations = [
        `${projectPath}/egdesk-scratch/${edit.filePath}`,
        `${projectPath}/egdesk-scratch/wordpress/${edit.filePath}`,
        `${projectPath}/wordpress/${edit.filePath}`,
        `${projectPath}/${edit.filePath.replace('www/', 'egdesk-scratch/wordpress/')}`,
        `${projectPath}/${edit.filePath.replace('www/', 'wordpress/')}`
      ];
      
      for (const path of pathVariations) {
        console.log('loadFileForEdit: Trying path:', path);
        result = await window.electron.fileSystem.readFile(path);
        if (result.success) {
          console.log('loadFileForEdit: Found file at:', path);
          break;
        }
      }
      
      if (!result.success) {
        console.error('Failed to read file with all path variations:', result.error);
        return;
      }
    }

    const currentContent = result.content || '';
    console.log('✅ DEBUG: loadFileForEdit - File content loaded successfully', {
      filePath: edit.filePath,
      contentLength: currentContent.length,
      firstLine: currentContent.split('\n')[0],
      totalLines: currentContent.split('\n').length
    });

    // Use the line numbers from the parsed operation, or find them by searching
    let lineNumber = 1;
    
    // Check if we have valid line numbers from the parsed operation
    if (edit.range?.startLine && !isNaN(edit.range.startLine) && edit.range.startLine > 0) {
      lineNumber = edit.range.startLine;
      console.log('🔍 DEBUG: Using range startLine', { lineNumber, range: edit.range });
    } else {
      // If line numbers are not valid, try to find the actual line by searching
      const lines = currentContent.split('\n');
      console.log('🔍 DEBUG: Searching for oldText in file lines', { 
        oldText: edit.oldText, 
        totalLines: lines.length 
      });
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(edit.oldText)) {
          lineNumber = i + 1;
          console.log('✅ DEBUG: Found oldText at line', { lineNumber, lineContent: lines[i] });
          break;
        }
      }
    }

    // Generate the diff data
    const diffData = {
      before: edit.oldText,
      after: edit.newText,
      lineNumber: lineNumber
    };
    
    console.log('🔍 DEBUG: Calling onShowDiff callback', {
      filePath: edit.filePath,
      diffData,
      hasOnShowDiff: !!onShowDiff
    });

    // Call the parent component to show the diff in the right panel
    if (onShowDiff) {
      onShowDiff(edit.filePath, diffData);
      console.log('✅ DEBUG: onShowDiff callback called successfully');
    } else {
      console.warn('⚠️ DEBUG: onShowDiff callback not provided - diff will not be shown in right panel');
    }

  } catch (error) {
    console.error('Failed to load file for edit:', error);
  }
};

/**
 * Apply edits directly to files using the enhanced FileWriterService
 */
export const applyEditsToFiles = async (
  edits: AIEdit[],
  projectRoot?: string
): Promise<{
  success: boolean;
  modifiedFiles: string[];
  errors: string[];
  backupPaths?: string[];
}> => {
  try {
    console.log(`🚀 Using enhanced FileWriterService to apply ${edits.length} edits`);
    
    console.log(`🔍 Project root for file operations: ${projectRoot}`);
    
    // Use the enhanced service from EnhancedAIEditorService
    const result = await EnhancedAIEditorService.applyEditsToFiles(edits, projectRoot);
    
    console.log(`📊 FileWriterService results:`, {
      success: result.success,
      modifiedFiles: result.modifiedFiles.length,
      errors: result.errors.length,
      backups: result.backupPaths?.length || 0
    });
    
    return result;
  } catch (error) {
    const errorMessage = `Enhanced file writer failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('❌', errorMessage);
    
    // Fallback to the original implementation
    console.log('🔄 Falling back to original file writing implementation');
    return await applyEditsToFilesLegacy(edits, projectRoot);
  }
};

/**
 * Legacy file writing implementation as fallback
 */
export const applyEditsToFilesLegacy = async (
  edits: AIEdit[],
  projectRoot?: string
): Promise<{
  success: boolean;
  modifiedFiles: string[];
  errors: string[];
}> => {
  const modifiedFiles: string[] = [];
  const errors: string[] = [];
  
  console.log('⚠️ Using legacy file writing implementation');
  
  try {
    for (const edit of edits) {
      try {
        // Resolve file path to absolute path
        let absoluteFilePath = edit.filePath || '';
        if (absoluteFilePath && !absoluteFilePath.startsWith('/') && !absoluteFilePath.startsWith('C:\\')) {
          if (projectRoot) {
            absoluteFilePath = `${projectRoot}/${absoluteFilePath}`;
          }
        }
        
        if (edit.type === 'create' && absoluteFilePath && edit.newText) {
          // Create new file
          const result = await window.electron.fileSystem.writeFile(absoluteFilePath, edit.newText);
          if (result.success) {
            modifiedFiles.push(absoluteFilePath);
            console.log(`Created file: ${absoluteFilePath}`);
          } else {
            errors.push(`Failed to create ${absoluteFilePath}: ${result.error}`);
          }
        } else if (edit.type === 'delete_file' && absoluteFilePath) {
          // Delete file
          const result = await window.electron.fileSystem.deleteItem(absoluteFilePath);
          if (result.success) {
            modifiedFiles.push(absoluteFilePath);
            console.log(`Deleted file: ${absoluteFilePath}`);
          } else {
            errors.push(`Failed to delete ${absoluteFilePath}: ${result.error}`);
          }
        } else if (edit.type === 'replace' && edit.oldText && edit.newText && absoluteFilePath) {
          // Handle search/replace operations
          const fileResult = await window.electron.fileSystem.readFile(absoluteFilePath);
          if (!fileResult.success) {
            errors.push(`Failed to read file ${absoluteFilePath}: ${fileResult.error}`);
            continue;
          }

          const currentContent = fileResult.content || '';
          
          if (currentContent.includes(edit.oldText)) {
            const newContent = currentContent.replace(edit.oldText, edit.newText);
            const writeResult = await window.electron.fileSystem.writeFile(absoluteFilePath, newContent);
            
            if (writeResult.success) {
              modifiedFiles.push(absoluteFilePath);
              console.log(`Search/replace successful in: ${absoluteFilePath}`);
            } else {
              errors.push(`Failed to write file ${absoluteFilePath}: ${writeResult.error}`);
            }
          } else {
            errors.push(`Search text not found in ${absoluteFilePath}`);
          }
        }
      } catch (error) {
        errors.push(`Error processing edit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      success: errors.length === 0,
      modifiedFiles,
      errors
    };
  } catch (error) {
    errors.push(`Failed to apply edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      modifiedFiles,
      errors
    };
  }
};
