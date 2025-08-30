# Project Context System

The Project Context System provides a centralized way to manage and track which project the user is currently working on across the entire application. This system automatically analyzes project structures and provides context-aware functionality.

## 🎯 **Features**

### **Automatic Project Detection**
- **Smart Analysis**: Automatically detects project types based on file structure
- **Multi-Language Support**: WordPress, Node.js, Python, Java, C/C++, and general web projects
- **Metadata Extraction**: Automatically extracts version, language, and framework information
- **Real-time Updates**: Refreshes project metadata when files change

### **Project Management**
- **Project Selection**: Easy switching between different projects
- **Recent Projects**: Quick access to recently worked on projects
- **Project History**: Tracks when projects were last accessed
- **Persistent Storage**: Remembers project context across application restarts

### **Integration Points**
- **CodeEditor**: Automatically loads project directory when switching projects
- **LocalServer**: Shows current project context and allows project-specific server management
- **AI Editor**: Uses project context for better code analysis and suggestions
- **Status Bar**: Displays current project information throughout the application

## 🏗️ **Architecture**

### **Core Components**

#### **ProjectContextService** (`src/renderer/services/projectContextService.ts`)
- **Singleton Service**: Manages global project state
- **Project Analysis**: Automatically detects project types and metadata
- **Context Management**: Handles project switching and persistence
- **Event System**: Notifies components of project changes

#### **ProjectSelector** (`src/renderer/components/ProjectSelector/`)
- **UI Component**: Dropdown for project selection and management
- **Compact Mode**: Space-efficient display for toolbars
- **Project Information**: Shows project type, language, and metadata
- **Quick Actions**: Add new projects and refresh metadata

### **Project Types Supported**

| Type | Detection Files | Icon | Description |
|------|----------------|-------|-------------|
| **WordPress** | `wp-config.php`, `wp-content/`, `wp-admin/` | 🐘 | WordPress sites and themes |
| **Node.js** | `package.json` | 🟢 | Node.js applications and packages |
| **Python** | `requirements.txt`, `pyproject.toml`, `setup.py` | 🐍 | Python projects and applications |
| **Java** | `pom.xml`, `build.gradle` | ☕ | Java applications and libraries |
| **C/C++** | `Makefile`, `CMakeLists.txt` | ⚙️ | C/C++ projects and applications |
| **Web** | `index.html`, `*.html` | 🌐 | General web projects |
| **Other** | Any folder | 📁 | Generic project folders |

## 🚀 **Usage**

### **Setting Current Project**

```typescript
import ProjectContextService from '../services/projectContextService';

// Set current project by path
const project = await ProjectContextService.getInstance().setCurrentProject('/path/to/project');

// Get current project
const currentProject = ProjectContextService.getInstance().getCurrentProject();

// Subscribe to project changes
const unsubscribe = ProjectContextService.getInstance().subscribe((context) => {
  console.log('Current project:', context.currentProject);
});
```

### **Using ProjectSelector Component**

```tsx
import ProjectSelector from '../components/ProjectSelector';

<ProjectSelector
  onProjectSelect={(project) => {
    // Handle project selection
    console.log('Selected project:', project);
  }}
  showCurrentProject={true}
  showRecentProjects={true}
  showAvailableProjects={false}
  className="compact"
/>
```

### **Project Information Access**

```typescript
const project = ProjectContextService.getInstance().getCurrentProject();

if (project) {
  console.log('Project Name:', project.name);
  console.log('Project Type:', project.type);
  console.log('Language:', project.metadata.language);
  console.log('Framework:', project.metadata.framework);
  console.log('Version:', project.metadata.version);
  console.log('Last Accessed:', project.lastAccessed);
}
```

## 🔧 **Configuration**

### **Project Analysis Settings**

The system automatically analyzes projects when they're selected:

- **File Detection**: Checks for framework-specific files
- **Metadata Extraction**: Reads configuration files for version and dependency info
- **Language Detection**: Identifies primary programming language
- **Structure Analysis**: Maps project hierarchy and relationships

### **Persistence**

- **Local Storage**: Projects are saved to browser localStorage
- **Auto-save**: Context changes are automatically persisted
- **Cross-session**: Project information persists across application restarts

## 📱 **UI Integration**

### **CodeEditor Toolbar**
- **Project Selector**: Compact dropdown showing current project
- **Quick Switch**: Easy project switching without leaving editor
- **Status Display**: Shows current project in status bar

### **LocalServer Interface**
- **Project Context Section**: Dedicated area for project information
- **Project Metadata**: Detailed view of project structure and properties
- **Server Integration**: Project-aware server management
- **Context Actions**: Refresh metadata and manage projects

### **Status Bar**
- **Project Indicator**: Visual indicator of current project
- **Type Icon**: Project type represented with emoji
- **Quick Info**: Project name and status

## 🔄 **Workflow**

### **Typical Usage Flow**

1. **Open Application**: System loads last used project (if any)
2. **Select Project**: Use ProjectSelector to choose or add new project
3. **Automatic Analysis**: System analyzes project structure and metadata
4. **Context Loading**: CodeEditor loads project directory
5. **Work on Project**: All components now have project context
6. **Switch Projects**: Seamlessly switch between different projects
7. **Persistent State**: Project context is saved for next session

### **Project Switching**

```
Current Project: WordPress Site (🐘)
    ↓
Select New Project: Node.js App (🟢)
    ↓
Automatic Analysis & Context Update
    ↓
CodeEditor loads new project directory
    ↓
LocalServer shows new project context
    ↓
AI Editor uses new project for context
```

## 🎨 **Customization**

### **Adding New Project Types**

```typescript
// Extend the ProjectInfo interface
interface ProjectInfo {
  // ... existing properties
  metadata: {
    // ... existing metadata
    hasCustomFramework?: boolean;
    customLanguage?: string;
  };
}

// Update detection logic in ProjectContextService
private determineProjectType(metadata: ProjectInfo['metadata']): ProjectInfo['type'] {
  if (metadata.hasCustomFramework) return 'custom';
  // ... existing logic
}
```

### **Custom Metadata Extraction**

```typescript
// Add custom metadata extraction methods
private async extractCustomMetadata(projectPath: string): Promise<any> {
  // Custom logic for your framework
  const customConfig = await this.readCustomConfig(projectPath);
  return {
    customProperty: customConfig.value,
    // ... other custom properties
  };
}
```

## 🚧 **Future Enhancements**

### **Planned Features**
- **Project Templates**: Pre-configured project setups
- **Dependency Analysis**: Deep dependency tree visualization
- **Project Health**: Code quality and security metrics
- **Team Collaboration**: Shared project contexts
- **Cloud Sync**: Project context synchronization across devices

### **Integration Opportunities**
- **Git Integration**: Branch-aware project contexts
- **Docker Support**: Container-based project management
- **CI/CD Integration**: Build and deployment context
- **Environment Management**: Development vs production contexts

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Project Not Detected**
- Check if project has framework-specific files
- Verify file permissions for project directory
- Try refreshing project metadata manually

#### **Context Not Updating**
- Ensure components are subscribed to ProjectContextService
- Check for console errors in browser developer tools
- Verify localStorage is not disabled

#### **Metadata Extraction Fails**
- Check if configuration files are readable
- Verify file formats are supported
- Try manual metadata refresh

### **Debug Information**

```typescript
// Enable debug logging
const project = await ProjectContextService.getInstance().setCurrentProject('/path/to/project');
console.log('Project Analysis Result:', project);

// Check service state
const context = ProjectContextService.getInstance().getContext();
console.log('Current Context:', context);
```

## 📚 **API Reference**

### **ProjectContextService Methods**

| Method | Description | Returns |
|--------|-------------|---------|
| `getInstance()` | Get service singleton instance | `ProjectContextService` |
| `subscribe(listener)` | Subscribe to context changes | `() => void` |
| `getContext()` | Get current project context | `ProjectContext` |
| `getCurrentProject()` | Get current active project | `ProjectInfo \| null` |
| `setCurrentProject(path)` | Set current project by path | `Promise<ProjectInfo \| null>` |
| `getProjectById(id)` | Get project by ID | `ProjectInfo \| null` |
| `getProjectByPath(path)` | Get project by path | `ProjectInfo \| null` |
| `removeProject(id)` | Remove project from context | `void` |
| `updateProjectMetadata(id)` | Refresh project metadata | `Promise<void>` |
| `refreshAllProjects()` | Refresh all projects metadata | `Promise<void>` |
| `clearContext()` | Clear all project context | `void` |

### **ProjectInfo Interface**

```typescript
interface ProjectInfo {
  id: string;                    // Unique project identifier
  name: string;                  // Project name (folder name)
  path: string;                  // Full project path
  type: ProjectType;             // Project type (wordpress, node, etc.)
  description?: string;          // Human-readable description
  lastAccessed: Date;            // Last access timestamp
  isActive: boolean;             // Whether project is currently active
  metadata: ProjectMetadata;     // Framework-specific metadata
}

interface ProjectMetadata {
  hasWordPress?: boolean;        // WordPress detection
  hasPackageJson?: boolean;      // Node.js detection
  hasRequirementsTxt?: boolean;  // Python detection
  hasPomXml?: boolean;          // Java detection
  hasMakefile?: boolean;         // C/C++ detection
  language?: string;             // Primary language
  framework?: string;            // Framework name
  version?: string;              // Project version
}
```

---

The Project Context System provides a robust foundation for managing multiple projects within the application, ensuring that all components have access to relevant project information and can adapt their behavior accordingly.
