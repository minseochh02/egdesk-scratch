# Codespace Integration in AI Chat

## Overview

The AI Chat now includes intelligent codespace context integration, powered by the `CodespaceVectorService`. This allows the AI to automatically search through your codebase and provide context-aware responses based on your actual code.

## How It Works

### 1. **Automatic Context Detection**
- When you send a message, the system automatically searches your codespace for relevant files
- The AI receives context about relevant code files, including:
  - File paths and languages
  - Code snippets around relevant areas
  - Import statements, classes, functions, and variables

### 2. **Enhanced System Prompts**
- The AI's system prompt is automatically enhanced with relevant code context
- This provides the AI with specific information about your project structure
- Responses become more accurate and actionable

### 3. **Smart File Search**
- Uses semantic search to find relevant files based on your message content
- Automatically limits results to prevent overwhelming the AI
- Caches analysis results for performance

## Features

### **Workspace Management**
- **Auto-detect**: Automatically detects your current workspace
- **Manual Input**: Set custom workspace paths
- **Refresh**: Force re-analysis of your codespace

### **Context Display**
- Shows codespace availability status
- Displays cache information (age, file count)
- Provides helpful tips for optimal usage

### **Performance Optimization**
- 24-hour cache expiration
- Automatic file filtering (max 100 files)
- Timeout protection for large workspaces

## Usage Examples

### **Code Questions**
```
User: "How do I implement authentication in this project?"
AI: [With context from your auth-related files] "Based on your codebase, I can see you have..."
```

### **Bug Investigation**
```
User: "Why is the login not working?"
AI: [With context from login-related code] "Looking at your login implementation in..."
```

### **Feature Development**
```
User: "I want to add a new API endpoint"
AI: [With context from your API structure] "I can see your current API setup in..."
```

## Technical Details

### **Integration Points**
- `CodespaceChatService`: Manages codespace context for chat
- `CodespaceVectorService`: Analyzes and searches the codebase
- Enhanced chat store with codespace awareness
- Automatic context injection into AI prompts

### **Supported Languages**
- JavaScript/TypeScript
- Python
- Java
- C/C++
- And many more (see `CodespaceVectorService` for full list)

### **Performance Features**
- Lazy loading of codespace analysis
- Intelligent caching with staleness detection
- Background analysis to avoid blocking the UI

## Benefits

1. **More Accurate Responses**: AI understands your specific codebase
2. **Faster Development**: No need to manually provide code context
3. **Better Debugging**: AI can reference specific files and line numbers
4. **Project Understanding**: AI learns your project structure over time
5. **Contextual Suggestions**: Recommendations based on your actual code

## Getting Started

1. **Set Workspace**: Use the auto-detect button or enter your project path
2. **Start Chatting**: Ask questions about your code naturally
3. **Enjoy Context**: AI automatically provides relevant code context
4. **Refresh When Needed**: Use refresh button after major code changes

## Troubleshooting

### **Codespace Not Available**
- Check if workspace path is set correctly
- Ensure the path contains source code files
- Try refreshing the codespace analysis

### **Slow Performance**
- Check cache status (should show recent analysis)
- Consider reducing the number of files in your workspace
- Use the refresh button to update analysis

### **Missing Context**
- Verify file extensions are supported
- Check if files contain actual source code
- Ensure workspace path includes all relevant directories

## Future Enhancements

- **Real-time Updates**: Watch for file changes and auto-refresh
- **Project Templates**: Pre-configured analysis for common project types
- **Advanced Filtering**: Exclude specific directories or file types
- **Collaborative Context**: Share codespace analysis across team members
