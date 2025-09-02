# Search & Replace Prompt Generator

A service and React component for generating precise search and replace operations for code files using AI.

## Overview

The Search & Replace Prompt Generator helps create exact text patterns that can be used with the `search_replace` tool. It generates search text that must be an EXACT match of existing code, along with the replacement text.

## Features

- **AI-Powered Generation**: Uses AI to understand your request and generate precise search/replace patterns
- **Exact Text Matching**: Ensures search text includes enough context to be unique
- **Proper Escaping**: Handles special characters, line breaks, and formatting
- **Copy to Clipboard**: Easy copying of generated prompts
- **Validation**: Ensures generated prompts are valid and complete

## Usage

### 1. Basic Usage

```typescript
import { SearchReplacePromptGenerator } from './SearchReplacePromptGenerator';

// In your component
<SearchReplacePromptGenerator
  aiKey={selectedKey}
  model={selectedModel}
  onGeneratePrompts={(prompts) => {
    console.log('Generated prompts:', prompts);
  }}
/>
```

### 2. Service Usage

#### Basic Usage
```typescript
import { SearchReplacePromptService } from '../services/searchReplacePromptService';

const service = SearchReplacePromptService.getInstance();
const response = await service.generateSearchReplacePrompts(aiKey, model, {
  userRequest: "Add a new option to the select dropdown",
  targetFile: "index.php",
  context: "This is a PHP file with HTML select elements"
});
```

#### Convenient Method (Minimal Parameters)
```typescript
const service = SearchReplacePromptService.getInstance();

// Just user request
const response1 = await service.generatePrompts(aiKey, model, "Add a new option to the select dropdown");

// With target file
const response2 = await service.generatePrompts(aiKey, model, "Add a new option to the select dropdown", "index.php");

// With target file and context
const response3 = await service.generatePrompts(aiKey, model, "Add a new option to the select dropdown", "index.php", "PHP file with HTML elements");
```

#### File-Specific Generation (with content analysis)
```typescript
const service = SearchReplacePromptService.getInstance();

// Generate prompts for a specific file
const response = await service.generatePromptsForFile(
  aiKey, 
  model, 
  "Add a new option to the select dropdown",
  "index.php",
  fileContent // Optional: file content for better AI understanding
);
```

## Input Fields

### Required
- **User Request**: Describe what you want to change (e.g., "Add a new option to the select dropdown")

### Optional
- **Target File**: Specify the file path for better context
- **Additional Context**: Any extra information about file structure or requirements
- **Example Before**: Existing code example to help with context
- **Example After**: What the result should look like

## Output Format

The service generates prompts in this format:

```json
[
  {
    "id": "unique_id_1",
    "description": "Brief description of what this change does",
    "searchText": "EXACT text to find (include surrounding context)",
    "replaceText": "EXACT text to replace it with",
    "filePath": "path/to/file.ext",
    "confidence": 0.95,
    "notes": "Any important notes about this change"
  }
]
```

## Critical Requirements

### 1. Search Text
- Must be an EXACT match of existing code
- Include exact whitespace and indentation
- Include enough surrounding context to be unique
- Preserve line breaks and formatting

### 2. Replace Text
- Must be exactly what you want the result to look like
- Include proper formatting and structure

### 3. Escaping
- Use `\n` for line breaks
- Use `\t` for tabs
- Use `\"` for quotes inside strings
- Use `\\` for backslashes

## Example Use Cases

### Adding a New Select Option

**User Request**: "Add a new option 'Custom Sensors' to the select dropdown"

**Generated Search Text**:
```html
<select name="SUB6" class="select1 select" style="display: none;" onchange="if(this.value) location.href=(this.value);">
    <option value="">------------------------------ Category ------------------------------</option>
    <option value="/ACB_CTs/ACB_CTs.php">ACB &amp; GIS Current Transformer</option>
</select>
```

**Generated Replace Text**:
```html
<select name="SUB6" class="select1 select" style="display: none;" onchange="if(this.value) location.href=(this.value);">
    <option value="">------------------------------ Category ------------------------------</option>
    <option value="/ACB_CTs/ACB_CTs.php">ACB &amp; GIS Current Transformer</option>
</select>
<select name="SUB7" class="select1 select" style="display: none;" onchange="if(this.value) location.href=(this.value);">
    <option value="">------------------------------ Category ------------------------------</option>
    <option value="/Custom_Sensors/Custom_Sensors.php">Custom Sensors</option>
</select>
```

### Updating CSS Rules

**User Request**: "Change the background color of .header to #2d2d30"

**Generated Search Text**:
```css
.header {
    background-color: #1e1e1e;
    padding: 20px;
}
```

**Generated Replace Text**:
```css
.header {
    background-color: #2d2d30;
    padding: 20px;
}
```

## Integration with search_replace Tool

The generated prompts can be directly used with the `search_replace` tool:

```typescript
// Example integration
const prompts = await service.generateSearchReplacePrompts(aiKey, model, request);

for (const prompt of prompts) {
  await search_replace(
    prompt.filePath || 'target_file.php',
    prompt.searchText,
    prompt.replaceText
  );
}
```

## Integration with AI Editor

You can easily integrate this service into your AI Editor workflow:

```typescript
// In your AI Editor component
import { SearchReplacePromptService } from './services/searchReplacePromptService';

const handleGenerateSearchReplace = async () => {
  const service = SearchReplacePromptService.getInstance();
  
  // Generate prompts for the current file
  const response = await service.generatePromptsForFile(
    selectedKey,
    selectedModel,
    userInstruction,
    currentFile.path,
    currentFile.content
  );
  
  if (response.success) {
    // Display the generated prompts
    setSearchReplacePrompts(response.searchReplacePrompts);
    
    // Or automatically apply them
    for (const prompt of response.searchReplacePrompts) {
      // Apply the search/replace operation
      await applySearchReplace(prompt);
    }
  }
};
```

## Best Practices

1. **Provide Clear Context**: The more context you give, the better the AI can generate precise patterns
2. **Use Examples**: Provide before/after examples for complex changes
3. **Specify File Paths**: Helps the AI understand the file structure
4. **Review Generated Prompts**: Always review the generated search/replace text before applying
5. **Test on Small Files**: Test the generated patterns on small files first

## Error Handling

The service includes comprehensive error handling:
- Validation of generated prompts
- Fallback for AI provider failures
- Clear error messages for debugging
- Graceful degradation when context is insufficient

## Future Enhancements

- Integration with actual AI providers
- Support for batch operations
- Preview functionality before applying changes
- Integration with version control systems
- Support for different file formats and languages
