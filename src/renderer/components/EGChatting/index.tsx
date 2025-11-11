import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { exampleEgChattingData } from './example';
import './EGChatting.css';

interface MCPServerTool {
  id: string;
  tool_name: string;
  description?: string;
  input_schema?: unknown;
}

interface MCPServerListItem {
  id: string;
  name: string;
  description?: string;
  connection_url?: string;
  is_active: boolean;
  tools: MCPServerTool[];
  internalName?: string;
}

type FileSystemEntryType = 'file' | 'directory' | 'symlink';

interface FileSystemNode {
  id: string;
  name: string;
  fullPath: string;
  type: FileSystemEntryType;
  children?: FileSystemNode[];
}

type ExampleServer = (typeof exampleEgChattingData.servers)[number];
type ExampleTool = ExampleServer['tools'][number];

const slugifyServerName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const DEFAULT_LOCAL_MCP_PORT = 8080;

const normalizeConnectionUrl = (rawUrl: string | undefined): string | undefined => {
  if (!rawUrl || rawUrl.trim().length === 0) {
    return `http://localhost:${DEFAULT_LOCAL_MCP_PORT}`;
  }

  if (rawUrl.startsWith('mcp://')) {
    return `http://localhost:${DEFAULT_LOCAL_MCP_PORT}`;
  }

  if (rawUrl.startsWith('http://0.0.0.0')) {
    return rawUrl.replace('http://0.0.0.0', 'http://localhost');
  }

  return rawUrl;
};

const toServerIdFromName = (name: string) => {
  const slug = slugifyServerName(name || 'server');
  return `server-${slug || 'unnamed'}`;
};

const mapExampleToolToListItem = (tool: ExampleTool): MCPServerTool => ({
  id: tool.id,
  tool_name: tool.tool_name,
  description: tool.description,
  input_schema: tool.input_schema,
});

const mapExampleServerToListItem = (server: ExampleServer): MCPServerListItem => {
  const baseId = server.id ?? toServerIdFromName(server.name);
  const rawInternalName = (server as { internal_name?: string }).internal_name;

  const normalizedInternalName =
    typeof rawInternalName === 'string'
      ? rawInternalName
      : baseId.startsWith('server-')
      ? baseId.replace(/^server-/, '')
      : slugifyServerName(server.name);

  return {
    id: baseId,
    name: server.name,
    description: server.description,
    connection_url: normalizeConnectionUrl(server.connection_url),
    is_active: server.is_active,
    tools: Array.isArray(server.tools) ? server.tools.map(mapExampleToolToListItem) : [],
    internalName: normalizedInternalName,
  };
};

type ChatParticipant = 'You' | 'Teammate' | 'EG Assistant';

interface ChatMessage {
  id: string;
  author: ChatParticipant;
  content: string;
  timestamp: string;
  isOwn?: boolean;
  toolCalls?: ToolCallEntry[];
}

interface ChatHistoryItem {
  id: string;
  title: string;
  lastMessagePreview: string;
  lastUpdated: string;
  unreadCount?: number;
  isActive?: boolean;
}

interface ChatTab {
  id: string;
  title: string;
  isActive?: boolean;
  isPinned?: boolean;
}

interface ToolCallEntry {
  id: string;
  toolName: string;
  serverName: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  triggerMessage?: string;
  inputPreview?: string;
  outputPreview?: string;
}

const EGChatting: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const conversations = exampleEgChattingData.conversations;
  const defaultServers = useMemo<MCPServerListItem[]>(
    () => exampleEgChattingData.servers.map(mapExampleServerToListItem),
    []
  );
  const defaultServersLookup = useMemo(() => {
    const map = new Map<string, MCPServerListItem>();
    defaultServers.forEach((server) => {
      map.set(server.id, server);
      map.set(server.name.toLowerCase(), server);
      if (server.internalName) {
        map.set(server.internalName.toLowerCase(), server);
      }
    });
    return map;
  }, [defaultServers]);
  const [servers, setServers] = useState<MCPServerListItem[]>(defaultServers);
  const [activatingServers, setActivatingServers] = useState<Record<string, boolean>>({});
  const [activeConversationId, setActiveConversationId] = useState(
    () => conversations[0]?.id ?? ''
  );
  const [sidePanelTab, setSidePanelTab] = useState<'filesystem' | 'servers'>('filesystem');
  const [expandedDirectories, setExpandedDirectories] = useState<Record<string, boolean>>({});
  const [fileSystemNodes, setFileSystemNodes] = useState<FileSystemNode[]>([]);
  const [fileSystemLoading, setFileSystemLoading] = useState(false);
  const [fileSystemError, setFileSystemError] = useState<string | null>(null);
  const [loadedDirectories, setLoadedDirectories] = useState<Record<string, boolean>>({});
  const [loadingDirectories, setLoadingDirectories] = useState<Record<string, boolean>>({});
  const [fileSystemRootLabel, setFileSystemRootLabel] = useState<string>('/');

  const mapFetchedToolToListItem = useCallback(
    (rawTool: unknown, serverId: string, index: number): MCPServerTool | null => {
      if (!rawTool || typeof rawTool !== 'object') {
        return null;
      }

      const toolRecord = rawTool as Record<string, unknown>;
      const toolIdCandidate =
        typeof toolRecord.id === 'string'
          ? toolRecord.id
          : typeof toolRecord.tool_name === 'string'
          ? toolRecord.tool_name
          : typeof toolRecord.name === 'string'
          ? toolRecord.name
          : `${serverId}-tool-${index}`;

      const toolNameCandidate =
        typeof toolRecord.tool_name === 'string'
          ? toolRecord.tool_name
          : typeof toolRecord.name === 'string'
          ? toolRecord.name
          : `Tool ${index + 1}`;

      const description =
        typeof toolRecord.description === 'string' ? toolRecord.description : undefined;

      const inputSchema =
        'input_schema' in toolRecord
          ? (toolRecord as { input_schema?: unknown }).input_schema
          : 'parameters' in toolRecord
          ? (toolRecord as { parameters?: unknown }).parameters
          : undefined;

      return {
        id: toolIdCandidate,
        tool_name: toolNameCandidate,
        description,
        input_schema: inputSchema,
      };
    },
    []
  );

  const fetchToolsForServer = useCallback(
    async (server: MCPServerListItem): Promise<MCPServerTool[] | null> => {
      if (!server.is_active || !server.connection_url) {
        return null;
      }

      const normalizedBaseUrl = normalizeConnectionUrl(server.connection_url);
      if (!normalizedBaseUrl) {
        return null;
      }

      const baseUrl = normalizedBaseUrl.replace(/\/$/, '');
      const internalSlug = server.internalName ?? slugifyServerName(server.name);
      const candidateUrls = Array.from(
        new Set([
          `${baseUrl}/${internalSlug}/tools`,
          `${baseUrl}/${internalSlug}`,
          `${baseUrl}/tools`,
          baseUrl,
        ])
      );

      for (const url of candidateUrls) {
        try {
          const response = await fetch(url, { method: 'GET' });
          if (!response.ok) continue;

          const payload = await response.json().catch(() => null);
          const toolsArray = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.tools)
            ? payload.tools
            : null;
          if (!toolsArray) continue;

          const mapped = toolsArray
            .map((tool: unknown, index: number) => mapFetchedToolToListItem(tool, server.id, index))
            .filter(
              (tool: MCPServerTool | null): tool is MCPServerTool => Boolean(tool)
            );
          if (mapped.length > 0) {
            return mapped;
          }
        } catch (error) {
          console.warn(`Failed to fetch REST tools for ${server.name} at ${url}`, error);
        }
      }

      try {
        const response = await fetch(`${baseUrl}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/list',
          }),
        });

        if (!response.ok) {
          return null;
        }

        const payload = await response.json().catch(() => null);
        const toolsArray = Array.isArray(payload?.result?.tools)
          ? payload.result.tools
          : Array.isArray(payload?.tools)
          ? payload.tools
          : null;

        if (!toolsArray) {
          return null;
        }

        const mapped = toolsArray
          .map((tool: unknown, index: number) => mapFetchedToolToListItem(tool, server.id, index))
          .filter(
            (tool: MCPServerTool | null): tool is MCPServerTool => Boolean(tool)
          );

        return mapped.length > 0 ? mapped : null;
      } catch (error) {
        console.warn(`Failed to fetch JSON-RPC tools for ${server.name}`, error);
        return null;
      }
    },
    [mapFetchedToolToListItem]
  );

  const normalizeTools = useCallback((tools: unknown, fallbackId: string): MCPServerTool[] => {
    if (!Array.isArray(tools)) {
      return [];
    }

    return tools
      .map((rawTool, index) => {
        if (!rawTool || typeof rawTool !== 'object') {
          return null;
        }

        const toolRecord = rawTool as Record<string, unknown>;
        const toolId =
          typeof toolRecord.id === 'string'
            ? toolRecord.id
            : `${fallbackId}-tool-${index}`;
        const toolNameCandidate =
          typeof toolRecord.tool_name === 'string'
            ? toolRecord.tool_name
            : typeof toolRecord.name === 'string'
            ? toolRecord.name
            : `Tool ${index + 1}`;
        const toolDescription =
          typeof toolRecord.description === 'string' ? toolRecord.description : undefined;

        const inputSchema =
          'input_schema' in toolRecord
            ? (toolRecord as { input_schema?: unknown }).input_schema
            : undefined;

        return {
          id: toolId,
          tool_name: toolNameCandidate,
          description: toolDescription,
          input_schema: inputSchema,
        } as MCPServerTool;
      })
      .filter((tool): tool is MCPServerTool => Boolean(tool));
  }, []);

  const fetchServers = useCallback(async (): Promise<MCPServerListItem[] | null> => {
    const electronApi = typeof window !== 'undefined' ? window.electron : undefined;
    if (!electronApi?.mcpConfig) {
      return defaultServers;
    }

    try {
      const [connectionsResult, configuredServersResult] = await Promise.all([
        electronApi.mcpConfig.connections
          .get()
          .catch((error: unknown) => {
            console.error('Failed to fetch MCP connections for EG Chatting:', error);
            return null;
          }),
        electronApi.mcpConfig.servers
          .get()
          .catch((error: unknown) => {
            console.error('Failed to fetch MCP servers for EG Chatting:', error);
            return null;
          }),
      ]);

      const fetchedConnections = Boolean(connectionsResult?.success);
      const fetchedServers = Boolean(configuredServersResult?.success);

      if (!fetchedConnections && !fetchedServers) {
        return defaultServers;
      }

      const normalizedServersMap = new Map<string, MCPServerListItem>();

      if (fetchedServers && Array.isArray(configuredServersResult?.servers)) {
        configuredServersResult.servers.forEach((server: any, index: number) => {
          const rawName =
            typeof server?.displayName === 'string'
              ? server.displayName
              : typeof server?.name === 'string'
              ? server.name
              : `Configured Server ${index + 1}`;
          const id =
            typeof server?.id === 'string'
              ? server.id
              : toServerIdFromName(rawName);
          const description =
            typeof server?.description === 'string' ? server.description : undefined;
          const rawConnectionUrl =
            typeof server?.connectionUrl === 'string'
              ? server.connectionUrl
              : typeof server?.url === 'string'
              ? server.url
              : undefined;
          const connectionUrl = normalizeConnectionUrl(rawConnectionUrl);
          const tools = normalizeTools(server?.tools, id);

          const internalName =
            typeof server?.name === 'string'
              ? server.name.toLowerCase()
              : id.replace(/^server-/, '');

          normalizedServersMap.set(id, {
            id,
            name: rawName,
            description,
            connection_url: connectionUrl,
            is_active:
              typeof server?.enabled === 'boolean' ? Boolean(server.enabled) : true,
            tools,
            internalName,
          });
        });
      }

      if (fetchedConnections && Array.isArray(connectionsResult?.connections)) {
        connectionsResult.connections.forEach((connection: any, index: number) => {
          const connectionType =
            typeof connection?.type === 'string'
              ? connection.type.toLowerCase()
              : undefined;
          const normalizedTypeId =
            connectionType && ['gmail', 'filesystem', 'file-conversion'].includes(connectionType)
              ? toServerIdFromName(connectionType)
              : null;

          const connectionName =
            typeof connection?.name === 'string'
              ? connection.name
              : connectionType
              ? `${connectionType} server`
              : `Connection ${index + 1}`;

          const id =
            normalizedTypeId ??
            (typeof connection?.id === 'string'
              ? connection.id
              : toServerIdFromName(connectionName));

          const description =
            typeof connection?.description === 'string'
              ? connection.description
              : connectionType
              ? `${connectionName} MCP connection`
              : undefined;

          const accessLevel = connection?.accessLevel;
          const bindAddress =
            accessLevel && typeof accessLevel.bindAddress === 'string'
              ? accessLevel.bindAddress
              : undefined;
          const port =
            accessLevel && typeof accessLevel.port === 'number'
              ? accessLevel.port
              : undefined;
          const publicUrl =
            accessLevel && typeof accessLevel.publicUrl === 'string'
              ? accessLevel.publicUrl
              : undefined;
          const localUrl =
            bindAddress && port ? `http://${bindAddress}:${port}` : undefined;

          const rawConnectionUrl =
            typeof connection?.connectionUrl === 'string'
              ? connection.connectionUrl
              : publicUrl ?? localUrl;
          const connectionUrl = normalizeConnectionUrl(rawConnectionUrl);

          const tools = normalizeTools(connection?.tools, id);

          const statusValue =
            typeof connection?.status === 'string' ? connection.status.toLowerCase() : null;
          const isActive =
            statusValue === 'stopped' || statusValue === 'disabled' ? false : true;

          const internalName =
            connectionType ??
            (typeof connection?.name === 'string' ? slugifyServerName(connection.name) : undefined);

          normalizedServersMap.set(id, {
            id,
            name: connectionName,
            description,
            connection_url: connectionUrl,
            is_active: isActive,
            tools,
            internalName,
          });
        });
      }

      defaultServers.forEach((server) => {
        if (!normalizedServersMap.has(server.id)) {
          normalizedServersMap.set(server.id, server);
        }
      });

      const normalizedServers = Array.from(normalizedServersMap.values())
        .map((server) => {
          const lookupKey =
            server.internalName?.toLowerCase() ||
            server.id ||
            server.name.toLowerCase();
          const fallback =
            defaultServersLookup.get(lookupKey) ??
            defaultServersLookup.get(server.id) ??
            defaultServersLookup.get(server.name.toLowerCase());

          const tools =
            server.tools && server.tools.length > 0
              ? server.tools
              : fallback?.tools ?? [];

          const connectionUrl = server.connection_url ?? fallback?.connection_url;

          const internalName = server.internalName ?? fallback?.internalName;

          return {
            ...server,
            tools,
            connection_url: connectionUrl,
            internalName,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const enrichedServers = await Promise.all(
        normalizedServers.map(async (server) => {
          const fetchedTools = await fetchToolsForServer(server);
          if (fetchedTools && fetchedTools.length > 0) {
            return { ...server, tools: fetchedTools };
          }
          return server;
        })
      );

      return enrichedServers;
    } catch (error) {
      console.error('Failed to load MCP server data for EG Chatting:', error);
      return null;
    }
  }, [defaultServers, defaultServersLookup, normalizeTools, fetchToolsForServer]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const next = await fetchServers();
      if (!cancelled && next) {
        setServers(next);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [fetchServers]);

  useEffect(() => {
  setSidePanelTab('filesystem');
}, [activeConversationId]);

  const handleActivateServer = useCallback(
    async (server: MCPServerListItem) => {
      const electronApi = typeof window !== 'undefined' ? window.electron : undefined;
      if (!electronApi) {
        console.warn('Electron API is not available in this environment.');
        return;
      }

      setActivatingServers((prev) => ({ ...prev, [server.id]: true }));
      try {
        let activated = false;
        const internalNameKey =
          server.internalName ??
          defaultServersLookup.get(server.id)?.internalName ??
          defaultServersLookup.get(server.name.toLowerCase())?.internalName;

        if (internalNameKey && electronApi.invoke) {
          try {
            const result = await electronApi.invoke('mcp-server-enable', internalNameKey);
            if (result?.success) {
              activated = true;
            }
          } catch (error) {
            console.error(`Failed to enable MCP server "${internalNameKey}":`, error);
          }
        }

        if (!activated && electronApi.httpsServer?.start) {
          try {
            const result = await electronApi.httpsServer.start({
              port: 8080,
              useHTTPS: false,
            });
            if (result?.success) {
              activated = true;
            }
          } catch (error) {
            console.error('Failed to start local HTTP server for MCP:', error);
          }
        }

        if (activated) {
          const refreshed = await fetchServers();
          if (refreshed) {
            setServers(refreshed);
          }
        }
      } finally {
        setActivatingServers((prev) => {
          const { [server.id]: _removed, ...rest } = prev;
          return rest;
        });
      }
    },
    [defaultServersLookup, fetchServers]
  );
  const serverLookup = useMemo(() => {
    return servers.reduce<Record<string, MCPServerListItem>>((acc, server) => {
      acc[server.id] = server;
      return acc;
    }, {});
  }, [servers]);
  const fileSystemServer = useMemo(() => {
    return (
      servers.find((server) => {
        const key = (server.internalName ?? slugifyServerName(server.name)).toLowerCase();
        return key.includes('filesystem');
      }) ?? null
    );
  }, [servers]);

  const activeConversation = useMemo(() => {
    return (
      conversations.find((conv) => conv.id === activeConversationId) ??
      conversations[0] ??
      null
    );
  }, [activeConversationId, conversations]);

  const directorySort = useCallback((a: FileSystemNode, b: FileSystemNode) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name);
    }
    if (a.type === 'directory') return -1;
    if (b.type === 'directory') return 1;
    if (a.type === 'symlink' && b.type !== 'symlink') return -1;
    if (b.type === 'symlink' && a.type !== 'symlink') return 1;
    return a.name.localeCompare(b.name);
  }, []);

  const updateNodesWithChildren = useCallback(
    (nodes: FileSystemNode[], targetPath: string, children: FileSystemNode[]): FileSystemNode[] => {
      return nodes.map((node) => {
        if (node.fullPath === targetPath) {
          return {
            ...node,
            children,
          };
        }
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: updateNodesWithChildren(node.children, targetPath, children),
          };
        }
        return node;
      });
    },
    []
  );

  const callFileSystemTool = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      if (!fileSystemServer) {
        throw new Error('File System MCP server is not configured.');
      }
      if (!fileSystemServer.is_active) {
        throw new Error('File System MCP server is offline. Start it from the MCP Servers tab.');
      }
      const baseUrlRaw = normalizeConnectionUrl(fileSystemServer.connection_url);
      if (!baseUrlRaw) {
        throw new Error('File System MCP server connection URL is missing.');
      }

      const baseUrl = baseUrlRaw.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/filesystem/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: toolName,
          arguments: args,
        }),
      });

      if (!response.ok) {
        throw new Error(`File System request failed (${response.status} ${response.statusText})`);
      }

      const json = await response.json().catch(() => null);
      if (!json?.success) {
        throw new Error(json?.error || 'File System MCP tool call failed.');
      }

      return json.result;
    },
    [fileSystemServer]
  );

  const loadDirectoryEntries = useCallback(
    async (targetPath: string): Promise<FileSystemNode[]> => {
      const result = await callFileSystemTool('fs_list_directory', { path: targetPath });
      let entries: Array<Record<string, any>> = [];

      if (Array.isArray(result?.content)) {
        const textEntry = result.content.find(
          (item: any) => item && typeof item.text === 'string'
        );
        if (textEntry?.text) {
          try {
            const parsed = JSON.parse(textEntry.text);
            if (Array.isArray(parsed)) {
              entries = parsed;
            } else if (Array.isArray(parsed?.entries)) {
              entries = parsed.entries;
            }
          } catch (error) {
            throw new Error('Failed to parse directory listing from MCP response.');
          }
        }
      } else if (Array.isArray(result)) {
        entries = result;
      } else if (Array.isArray(result?.entries)) {
        entries = result.entries;
      }

      const nodes: FileSystemNode[] = entries
        .filter((entry) => entry && typeof entry.name === 'string' && typeof entry.path === 'string')
        .map((entry) => {
          const type: FileSystemEntryType =
            entry.type === 'directory'
              ? 'directory'
              : entry.type === 'symlink'
              ? 'symlink'
              : 'file';
          return {
            id: entry.path,
            name: entry.name,
            fullPath: entry.path,
            type,
            children: type === 'directory' ? [] : undefined,
          };
        })
        .sort(directorySort);

      return nodes;
    },
    [callFileSystemTool, directorySort]
  );

  const loadRootDirectory = useCallback(async () => {
    if (!activeConversation) {
      setFileSystemNodes([]);
      setFileSystemError(null);
      setFileSystemLoading(false);
      return;
    }

    setFileSystemLoading(true);
    setFileSystemError(null);
    setExpandedDirectories({});
    setLoadedDirectories({});
    setLoadingDirectories({});

    if (!fileSystemServer) {
      setFileSystemLoading(false);
      setFileSystemError('File System MCP server is not configured.');
      setFileSystemNodes([]);
      return;
    }

    if (!fileSystemServer.is_active) {
      setFileSystemLoading(false);
      setFileSystemError('File System MCP server is offline. Start it from the MCP Servers tab.');
      setFileSystemNodes([]);
      return;
    }

    try {
      const nodes = await loadDirectoryEntries('/');
      setFileSystemNodes(nodes);
      const sample = nodes[0];
      if (sample) {
        const normalized = sample.fullPath ? sample.fullPath.replace(/\\/g, '/') : '';
        const suffixIndex =
          sample.name && normalized.endsWith(sample.name)
            ? normalized.length - sample.name.length
            : normalized.lastIndexOf('/');
        const basePath =
          suffixIndex >= 0 ? normalized.slice(0, suffixIndex).replace(/\/$/, '') : normalized;
        setFileSystemRootLabel(basePath ? basePath : '/');
      } else {
        setFileSystemRootLabel('/');
      }
    } catch (error) {
      setFileSystemNodes([]);
      setFileSystemError(
        error instanceof Error ? error.message : 'Failed to load file system.'
      );
    } finally {
      setFileSystemLoading(false);
    }
  }, [activeConversation, fileSystemServer, loadDirectoryEntries]);

  const handleFileSystemRefresh = useCallback(() => {
    void loadRootDirectory();
  }, [loadRootDirectory]);

  const handleDirectoryToggle = useCallback(
    async (node: FileSystemNode) => {
      const currentlyExpanded = expandedDirectories[node.fullPath] ?? false;
      const nextExpanded = !currentlyExpanded;
      setExpandedDirectories((prev) => ({
        ...prev,
        [node.fullPath]: nextExpanded,
      }));

      if (nextExpanded && !loadedDirectories[node.fullPath]) {
        setLoadingDirectories((prev) => ({
          ...prev,
          [node.fullPath]: true,
        }));
        try {
          const children = await loadDirectoryEntries(node.fullPath);
          setFileSystemNodes((prev) =>
            updateNodesWithChildren(prev, node.fullPath, children)
          );
          setLoadedDirectories((prev) => ({
            ...prev,
            [node.fullPath]: true,
          }));
          setFileSystemError(null);
        } catch (error) {
          setFileSystemError(
            error instanceof Error ? error.message : 'Failed to load directory.'
          );
        } finally {
          setLoadingDirectories((prev) => {
            const { [node.fullPath]: _removed, ...rest } = prev;
            return rest;
          });
        }
      }
    },
    [
      expandedDirectories,
      loadedDirectories,
      loadDirectoryEntries,
      updateNodesWithChildren,
    ]
  );

  useEffect(() => {
    setSidePanelTab('filesystem');
  }, [activeConversationId]);

  useEffect(() => {
    void loadRootDirectory();
  }, [loadRootDirectory, activeConversationId]);

  const renderFileSystemNodes = useCallback(
    (nodes: FileSystemNode[], depth = 0): React.ReactElement | null => {
      if (!nodes || nodes.length === 0) {
        return null;
      }

      return (
        <ul className="eg-chatting__filesystem-list" role={depth === 0 ? 'tree' : 'group'}>
          {nodes.map((node) => {
            const hasChildren = Array.isArray(node.children) && node.children.length > 0;
            const isExpanded =
              expandedDirectories[node.fullPath] !== undefined
                ? expandedDirectories[node.fullPath]
                : depth === 0;

            return (
              <li
                key={node.id}
                className="eg-chatting__filesystem-node"
                role="treeitem"
                aria-expanded={node.type === 'directory' ? isExpanded : undefined}
              >
                <div
                  className="eg-chatting__filesystem-item"
                  style={{ paddingLeft: `${depth * 16 + 8}px` }}
                >
                  {node.type === 'directory' ? (
                    <button
                      type="button"
                      className="eg-chatting__filesystem-toggle"
                      onClick={() => handleDirectoryToggle(node)}
                      aria-expanded={isExpanded}
                    >
                      <span
                        className={`eg-chatting__filesystem-chevron${
                          isExpanded ? ' eg-chatting__filesystem-chevron--open' : ''
                        }`}
                      />
                      <span className="eg-chatting__filesystem-icon" aria-hidden="true">
                        📁
                      </span>
                      <span className="eg-chatting__filesystem-name">{node.name}</span>
                      {loadingDirectories[node.fullPath] ? (
                        <span className="eg-chatting__filesystem-spinner" aria-hidden="true" />
                      ) : null}
                    </button>
                  ) : (
                    <span className="eg-chatting__filesystem-leaf">
                      <span className="eg-chatting__filesystem-icon" aria-hidden="true">
                        {node.type === 'symlink' ? '🔗' : '📄'}
                      </span>
                      <span className="eg-chatting__filesystem-name">{node.name}</span>
                    </span>
                  )}
                </div>
                {node.type === 'directory' && hasChildren && isExpanded
                  ? renderFileSystemNodes(node.children!, depth + 1)
                  : null}
              </li>
            );
          })}
        </ul>
      );
    },
    [expandedDirectories, handleDirectoryToggle]
  );

  const chatHistory = useMemo<ChatHistoryItem[]>(() => {
    return conversations.map((conversation) => {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      return {
        id: conversation.id,
        title: conversation.title,
        lastMessagePreview: lastMessage?.content ?? 'No messages yet',
        lastUpdated: new Date(conversation.updated_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        unreadCount: 0,
        isActive: conversation.id === activeConversation?.id,
      };
    });
  }, [conversations, activeConversation]);

  const chatTabs = useMemo<ChatTab[]>(() => {
    return conversations.map((conversation, index) => ({
      id: conversation.id,
      title: `Server ${index + 1}: ${conversation.title}`,
      isActive: conversation.id === activeConversation?.id,
      isPinned: index === 0,
    }));
  }, [conversations, activeConversation]);

  const toolCallEntries = useMemo<ToolCallEntry[]>(() => {
    if (!activeConversation) return [];

    return activeConversation.toolCalls.map((toolCall) => {
      const linkedMessage = activeConversation.messages.find(
        (message) => message.id === toolCall.message_id
      );

      const serverName = serverLookup[toolCall.server_id]?.name ?? toolCall.server_id;
      const inputPreview = JSON.stringify(toolCall.input_params, null, 2);
      const outputPreview = toolCall.output_result
        ? JSON.stringify(toolCall.output_result, null, 2)
        : undefined;

      return {
        id: toolCall.id,
        toolName: toolCall.tool_name,
        serverName,
        status: toolCall.status,
        startedAt: new Date(toolCall.started_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        completedAt: toolCall.completed_at
          ? new Date(toolCall.completed_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : undefined,
        triggerMessage: linkedMessage?.content,
        inputPreview,
        outputPreview,
      };
    });
  }, [activeConversation, serverLookup]);

  const toolCallsByMessageId = useMemo<Record<string, ToolCallEntry[]>>(() => {
    if (!activeConversation) return {};

    return activeConversation.toolCalls.reduce<Record<string, ToolCallEntry[]>>((acc, toolCall) => {
      const entry = toolCallEntries.find((candidate) => candidate.id === toolCall.id);
      if (!entry) return acc;
      if (!acc[toolCall.message_id]) acc[toolCall.message_id] = [];
      acc[toolCall.message_id].push(entry);
      return acc;
    }, {});
  }, [activeConversation, toolCallEntries]);

  const messages = useMemo<ChatMessage[]>(() => {
    if (!activeConversation) return [];

    return activeConversation.messages.map((message) => ({
      id: message.id,
      author:
        message.role === 'user'
          ? 'You'
          : message.role === 'assistant'
          ? 'EG Assistant'
          : ('Teammate' as ChatParticipant),
      content: message.content,
      timestamp: new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      isOwn: message.role === 'user',
      toolCalls: toolCallsByMessageId[message.id] ?? [],
    }));
  }, [activeConversation, toolCallsByMessageId]);

  const accountName = useMemo(() => {
    if (!user) return 'Guest';
    const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
    if (fullName) return fullName;
    const emailPrefix = user.email?.split('@')[0];
    return emailPrefix || 'EG User';
  }, [user]);

  const accountEmail = user?.email ?? 'Sign in to sync conversations';
  const accountInitial = accountName.charAt(0).toUpperCase();
  const accountStatus = authLoading ? 'Connecting…' : user ? 'Connected' : 'Not signed in';

  return (
    <div className="eg-chatting eg-chatting--two-column">
      <aside className="eg-chatting__sidebar">
        <div className="eg-chatting__sidebar-inner">
          <section className="eg-chatting__account" aria-label="Signed in account">
            <div className="eg-chatting__avatar" aria-hidden="true">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url as string} alt={accountName} />
              ) : (
                <span>{accountInitial}</span>
              )}
            </div>
            <div className="eg-chatting__account-details">
              <span className="eg-chatting__account-name">{accountName}</span>
              <span className="eg-chatting__account-email">{accountEmail}</span>
            </div>
            <span
              className={`eg-chatting__account-status${
                user ? ' eg-chatting__account-status--online' : ' eg-chatting__account-status--offline'
              }`}
            >
              {accountStatus}
            </span>
          </section>

          <div className="eg-chatting__sidebar-scroll">
            <header className="eg-chatting__sidebar-header">
              <h1>EG Chatting</h1>
              <button className="eg-chatting__new-chat">New Chat</button>
            </header>

            <div className="eg-chatting__sidebar-search">
              <input type="search" placeholder="Search conversations" />
            </div>

            <nav className="eg-chatting__history">
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  className={`eg-chatting__history-item${
                    chat.isActive ? ' eg-chatting__history-item--active' : ''
                  }`}
                  onClick={() => setActiveConversationId(chat.id)}
                >
                  <span className="eg-chatting__history-title">{chat.title}</span>
                  <span className="eg-chatting__history-preview">{chat.lastMessagePreview}</span>
                  <span className="eg-chatting__history-meta">
                    <span className="eg-chatting__history-updated">{chat.lastUpdated}</span>
                    {chat.unreadCount ? (
                      <span className="eg-chatting__history-unread">{chat.unreadCount}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </aside>

      <main className="eg-chatting__workspace">
        <div className="eg-chatting__tabs">
          {chatTabs.map((tab) => (
            <button
              key={tab.id}
              className={`eg-chatting__tab${tab.isActive ? ' eg-chatting__tab--active' : ''}`}
              onClick={() => setActiveConversationId(tab.id)}
            >
              {tab.isPinned ? (
                <span className="eg-chatting__tab-pin" aria-hidden="true">
                  📌
                </span>
              ) : null}
              <span className="eg-chatting__tab-title">{tab.title}</span>
              <span className="eg-chatting__tab-close" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
          <button className="eg-chatting__tab eg-chatting__tab--add" aria-label="Add tab">
            +
          </button>
        </div>

        <div className="eg-chatting__main">
        <section className="eg-chatting__chat-window" aria-label="Active chat thread">
          <header className="eg-chatting__chat-header">
            <div className="eg-chatting__chat-title">
              <span className="eg-chatting__chat-name">
                {activeConversation?.title ?? 'Conversation'}
              </span>
              <span className="eg-chatting__chat-status">Live · synced</span>
            </div>
            <div className="eg-chatting__chat-actions">
              <button>Share</button>
              <button>History</button>
              <button>Settings</button>
            </div>
          </header>

          <div className="eg-chatting__message-feed">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`eg-chatting__message${message.isOwn ? ' eg-chatting__message--own' : ''}`}
              >
                <header className="eg-chatting__message-meta">
                  <span className="eg-chatting__message-author">{message.author}</span>
                  <time>{message.timestamp}</time>
                </header>
                <p className="eg-chatting__message-content">{message.content}</p>
                {message.toolCalls && message.toolCalls.length > 0 ? (
                  <div className="eg-chatting__toolcall-group">
                    {message.toolCalls.map((entry) => (
                      <div key={entry.id} className="eg-chatting__toolcall-card">
                        <div className="eg-chatting__toolcall-heading">
                          <span className="eg-chatting__toolcall-icon" aria-hidden="true">
                            🔧
                          </span>
                          <div className="eg-chatting__toolcall-title">
                            <span className="eg-chatting__toolcall-name">{entry.toolName}</span>
                            <span className="eg-chatting__toolcall-server">{entry.serverName}</span>
                          </div>
                          <span
                            className={`eg-chatting__toolcall-status eg-chatting__toolcall-status--${entry.status}`}
                          >
                            {entry.status}
                          </span>
                        </div>
                        <details className="eg-chatting__toolcall-details">
                          <summary>Parameters &amp; result</summary>
                          <div className="eg-chatting__toolcall-json">
                            <strong>Input</strong>
                            <pre>{entry.inputPreview}</pre>
                            {entry.outputPreview ? (
                              <>
                                <strong>Output</strong>
                                <pre>{entry.outputPreview}</pre>
                              </>
                            ) : null}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <footer className="eg-chatting__composer">
            <textarea placeholder="Type a message, ask EG Assistant, or use /commands…" rows={3} />
            <div className="eg-chatting__composer-actions">
              <button>Attach</button>
              <button>Run Task</button>
              <button className="eg-chatting__composer-send">Send</button>
            </div>
          </footer>
        </section>

        <div className="eg-chatting__sidepanel">
          <div className="eg-chatting__sidepanel-tabs" role="tablist" aria-label="Workspace views">
            <button
              type="button"
              role="tab"
              aria-selected={sidePanelTab === 'filesystem'}
              className={`eg-chatting__sidepanel-tab${
                sidePanelTab === 'filesystem' ? ' eg-chatting__sidepanel-tab--active' : ''
              }`}
              onClick={() => setSidePanelTab('filesystem')}
            >
              File System
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidePanelTab === 'servers'}
              className={`eg-chatting__sidepanel-tab${
                sidePanelTab === 'servers' ? ' eg-chatting__sidepanel-tab--active' : ''
              }`}
              onClick={() => setSidePanelTab('servers')}
            >
              MCP Servers
            </button>
          </div>
          <div className="eg-chatting__sidepanel-body">
            {sidePanelTab === 'filesystem' ? (
              <div className="eg-chatting__filesystem" aria-label="Workspace file system" role="tabpanel">
                <header className="eg-chatting__filesystem-header">
                  <div>
                    <h2>{fileSystemServer?.name ?? 'File System'}</h2>
                    <p>{fileSystemRootLabel}</p>
                  </div>
                  <button
                    type="button"
                    className="eg-chatting__filesystem-refresh"
                    onClick={handleFileSystemRefresh}
                    disabled={fileSystemLoading}
                    title="Reload directory"
                  >
                    <span className="eg-chatting__filesystem-refresh-icon" aria-hidden="true">
                      ↻
                    </span>
                    <span className="eg-chatting__filesystem-refresh-label">Refresh</span>
                  </button>
                </header>
                <div className="eg-chatting__filesystem-tree" role="presentation">
                  {!fileSystemServer ? (
                    <div className="eg-chatting__filesystem-empty">
                      <p>Not connected to MCP File System server.</p>
                      <p>Switch to the "MCP Servers" tab to enable the File System MCP server.</p>
                    </div>
                  ) : !fileSystemServer.is_active ? (
                    <div className="eg-chatting__filesystem-empty">
                      <p>File System MCP server is offline.</p>
                      <p>Switch to the "MCP Servers" tab and click "Start server" to enable it.</p>
                    </div>
                  ) : fileSystemLoading ? (
                    <div className="eg-chatting__filesystem-status">
                      <span className="eg-chatting__filesystem-spinner" aria-hidden="true" />
                      <span>Loading directory…</span>
                    </div>
                  ) : fileSystemError ? (
                    <div className="eg-chatting__filesystem-status eg-chatting__filesystem-status--error">
                      <p>{fileSystemError}</p>
                      <button type="button" onClick={handleFileSystemRefresh}>
                        Try again
                      </button>
                    </div>
                  ) : fileSystemNodes.length > 0 ? (
                    renderFileSystemNodes(fileSystemNodes)
                  ) : (
                    <div className="eg-chatting__filesystem-empty">
                      <p>No files found in the current working directory.</p>
                      <p>Adjust the MCP file system configuration to expose your project path.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <aside className="eg-chatting__servers" aria-label="Available MCP servers" role="tabpanel">
                <header className="eg-chatting__servers-header">
                  <h2>MCP Servers</h2>
                  <span>{servers.length} connected</span>
                </header>
                <div className="eg-chatting__servers-list">
                  {servers.map((server) => (
                    <article key={server.id} className="eg-chatting__server-card">
                      <div className="eg-chatting__server-heading">
                        <span className="eg-chatting__server-icon" aria-hidden="true">
                          🖥️
                        </span>
                        <div className="eg-chatting__server-title">
                          <span className="eg-chatting__server-name">{server.name}</span>
                          {server.description ? (
                            <span className="eg-chatting__server-description">{server.description}</span>
                          ) : null}
                          {server.connection_url ? (
                            <span className="eg-chatting__server-url" title={server.connection_url}>
                              {server.connection_url}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`eg-chatting__server-status${
                            server.is_active
                              ? ' eg-chatting__server-status--online'
                              : ' eg-chatting__server-status--offline'
                          }`}
                        >
                          {server.is_active ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="eg-chatting__server-tools">
                        <h3>Tools</h3>
                        <ul>
                          {server.tools.map((tool) => (
                            <li key={tool.id}>
                              <span className="eg-chatting__server-tool-name">{tool.tool_name}</span>
                              {tool.description ? (
                                <span className="eg-chatting__server-tool-description">{tool.description}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {!server.is_active ? (
                        <button
                          type="button"
                          className="eg-chatting__server-action"
                          onClick={() => handleActivateServer(server)}
                          disabled={Boolean(activatingServers[server.id])}
                        >
                          {activatingServers[server.id] ? 'Starting…' : 'Start server'}
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
        </div>

      </main>
    </div>
  );
};

export default EGChatting;

