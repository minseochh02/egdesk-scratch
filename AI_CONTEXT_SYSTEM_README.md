# AI Context System: How EGDesk Scratch Finds and Sends Code to AI

## Overview

EGDesk Scratch includes an intelligent system that automatically finds the most relevant code files from your project and sends them to AI models as context. This allows AI to understand your codebase and provide accurate, project-specific assistance without you having to manually select which files to share.

## How It Works

### 1. Automatic Workspace Scanning

When you first use the AI features, the system automatically scans your entire project workspace. It looks through all your code files, skipping common directories like `node_modules`, `.git`, and build folders. The system recognizes various programming languages including TypeScript, JavaScript, Python, Java, C++, PHP, HTML, CSS, and many others.

During this scan, the system analyzes each file to understand:
- What the file contains (functions, classes, variables)
- How files are connected through imports and dependencies
- The overall structure and patterns in your codebase
- Which files are most important or commonly referenced

### 2. Building a Smart Search Index

After scanning, the system creates an intelligent search index that maps different concepts to relevant files. This isn't just a simple text search - it understands the meaning and relationships between different parts of your code.

For example, if you have a WordPress project, the system knows that files like `index.php`, `wp-config.php`, and `wp-load.php` are core files. It also understands that when you mention "homepage" or "main page," you're likely referring to your `index.php` file.

### 3. Intelligent Context Gathering

When you ask AI for help or request code changes, the system doesn't just look at the current file you're editing. Instead, it uses several smart strategies to gather the most relevant context:

#### Proximity-Based Context
If you're editing a specific function, the system automatically includes code that's nearby - typically within 3 lines above and below your cursor position. This gives AI immediate context about what you're working on.

#### Symbol-Based Expansion
The system follows the connections between your code. If you're working with a function that imports other modules or uses specific classes, it automatically includes those related files. It does this intelligently, limiting how deep it goes to prevent overwhelming the AI with too much information.

#### Semantic Search
Using AI-powered understanding, the system searches your entire codebase for files that are semantically related to your request. For instance, if you ask about "authentication," it will find all files related to login, security, user management, and similar concepts.

### 4. Smart Context Prioritization

Not all context is equally important. The system uses a sophisticated weighting system to prioritize what gets sent to AI:

- **Highest Priority (Weight 10)**: Code immediately around your cursor position
- **High Priority (Weight 8)**: Function and class definitions near your current location
- **Medium Priority (Weight 7-5)**: Imported modules and dependencies
- **Lower Priority (Weight 6)**: Semantically related files found through AI search

This ensures that AI gets the most relevant information first, while still having access to broader context when needed.

### 5. Context Optimization and Management

The system is designed to prevent information overload. It automatically:

- Removes duplicate or overlapping code sections
- Limits the size of individual code snippets
- Ensures there's enough space left for AI to respond
- Caches analysis results to avoid re-scanning unchanged files
- Provides fallback search methods if the primary search fails

### 6. Sending Context to AI

Once the system has gathered and optimized the relevant context, it creates a structured prompt that includes:

- A summary of what files were found and why they're relevant
- Specific code snippets with their file paths and line numbers
- Information about the current file you're editing
- Your specific request or question
- The complete content of the current file (or a relevant portion)

This context is then sent to the AI model along with your request, giving the AI a complete understanding of your project structure and the specific problem you're trying to solve.

## What This Means for You

### Automatic Discovery
You don't need to manually figure out which files to show the AI. The system automatically discovers and includes the most relevant code.

### Accurate Responses
AI models can provide much more accurate and specific answers because they understand your actual codebase, not just generic programming concepts.

### Context-Aware Suggestions
When AI suggests code changes, it can reference specific functions, classes, or patterns that already exist in your project.

### Efficient Problem Solving
The system focuses on the most relevant information, so AI responses are faster and more targeted to your specific situation.

## Behind the Scenes

The system works continuously in the background:
- It monitors your workspace for changes and updates its understanding
- It maintains a cache of analyzed files to avoid repeated work
- It adapts its search strategies based on the type of request you make
- It provides fallback methods if the primary search approach fails

## Benefits

1. **No Manual File Selection**: The system automatically finds what's relevant
2. **Intelligent Context**: AI gets the most important information first
3. **Performance Optimized**: Fast response times through smart caching
4. **Language Agnostic**: Works with any programming language in your project
5. **Adaptive Learning**: Improves its understanding of your project over time
6. **Fallback Safety**: Multiple search strategies ensure you always get relevant context

This intelligent context system transforms how you interact with AI coding assistants, making them much more effective by giving them a comprehensive understanding of your specific project structure and codebase.
