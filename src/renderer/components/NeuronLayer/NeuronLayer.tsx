import React, { useState, useCallback, useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { NeuronNode, NeuronLink } from '../../hooks/useNeuronData';
import { useDataSources, DataSource, getProcessingState } from '../../hooks/useDataSources';
import './NeuronLayer.css';

// ─── Constants ────────────────────────────────────────────────────────────────

// Preset colors/labels for well-known types; unknown types get a fallback color
const PRESET_COLORS: Record<string, string> = {
  company:  '#00ff88',
  person:   '#bf5fff',
  product:  '#00cfff',
  location: '#ff6b35',
  concept:  '#ffdd00',
};

const FALLBACK_COLORS = ['#ff6b9d', '#ffa040', '#40d4ff', '#a0ff80', '#ffcc40'];

const PRESET_LABELS: Record<string, string> = {
  company:  'Company',
  person:   'Person',
  product:  'Product',
  location: 'Location',
  concept:  'Concept',
};

function typeColor(type: string, allTypes: string[]): string {
  if (PRESET_COLORS[type]) return PRESET_COLORS[type];
  const idx = allTypes.indexOf(type);
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

function typeLabel(type: string): string {
  return PRESET_LABELS[type] ?? (type.charAt(0).toUpperCase() + type.slice(1));
}

type ActiveTab = 'graph' | 'sources';

const FIXED_ORIGIN_LABELS: Record<string, string> = {
  userdata:        'mydb',
  financehub:      'Finance Hub',
  companyresearch: 'Client Research',
};
// Origins that expand into per-group sections instead of one block
const GROUPED_ORIGINS = new Set(['businessidentity']);

// ─── Mock data (frontend demo — replace hooks with live IPC when wiring) ──────

const MOCK_ENTITIES: NeuronNode[] = [
  { id: 'c1',  type: 'company',  name: '(주)태성이앤지',    tables: ['고객 마스터'],   rowCount: 24831 },
  { id: 'c2',  type: 'company',  name: '현대건설',          tables: ['거래처 목록'],   rowCount: 3204  },
  { id: 'c3',  type: 'company',  name: '삼성물산',          tables: ['거래처 목록'],   rowCount: 3204  },
  { id: 'c4',  type: 'company',  name: '포스코건설',        tables: ['거래처 목록'],   rowCount: 3204  },
  { id: 'c5',  type: 'company',  name: 'GS건설',            tables: ['거래처 목록'],   rowCount: 3204  },
  { id: 'p1',  type: 'person',   name: '김민준',            tables: ['직원 정보'],     rowCount: 87    },
  { id: 'p2',  type: 'person',   name: '이지은',            tables: ['직원 정보'],     rowCount: 87    },
  { id: 'p3',  type: 'person',   name: '박현우',            tables: ['직원 정보'],     rowCount: 87    },
  { id: 'pr1', type: 'product',  name: '전기설비 공사',      tables: ['상품 카탈로그'], rowCount: 1890  },
  { id: 'pr2', type: 'product',  name: '소방 시스템',        tables: ['상품 카탈로그'], rowCount: 1890  },
  { id: 'pr3', type: 'product',  name: '태양광 패널',        tables: ['상품 카탈로그'], rowCount: 1890  },
  { id: 'l1',  type: 'location', name: '서울 강남구',        tables: [],               rowCount: 0     },
  { id: 'l2',  type: 'location', name: '인천 서구',          tables: [],               rowCount: 0     },
  { id: 'k1',  type: 'concept',  name: '재생에너지',         tables: [],               rowCount: 0     },
  { id: 'k2',  type: 'concept',  name: '스마트 빌딩',        tables: [],               rowCount: 0     },
];

const MOCK_RELATIONS: NeuronLink[] = [
  { source: 'c1',  target: 'c2',  label: '계약' },
  { source: 'c1',  target: 'c3',  label: '계약' },
  { source: 'c1',  target: 'c4',  label: '파트너십' },
  { source: 'c1',  target: 'c5',  label: '계약' },
  { source: 'p1',  target: 'c1',  label: '재직' },
  { source: 'p2',  target: 'c1',  label: '재직' },
  { source: 'p3',  target: 'c2',  label: '담당자' },
  { source: 'c1',  target: 'pr1', label: '공급' },
  { source: 'c1',  target: 'pr2', label: '공급' },
  { source: 'c3',  target: 'pr3', label: '발주' },
  { source: 'pr1', target: 'l1',  label: '시공지' },
  { source: 'pr2', target: 'l2',  label: '시공지' },
  { source: 'pr3', target: 'k1',  label: '관련' },
  { source: 'c4',  target: 'l1',  label: '현장' },
  { source: 'k1',  target: 'k2',  label: '포함' },
  { source: 'p1',  target: 'pr1', label: '담당' },
  { source: 'c2',  target: 'l2',  label: '현장' },
  { source: 'c5',  target: 'k2',  label: '관심' },
  { source: 'p2',  target: 'k1',  label: '전문' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const NeuronLayer: React.FC = () => {
  // Graph: mock data (replace with useNeuronData() once DB is wired)
  const entities  = MOCK_ENTITIES;
  const relations = MOCK_RELATIONS;
  const loading   = false;
  // Data Sources: live IPC
  const { sources, loading: sourcesLoading } = useDataSources();
  const [activeTab, setActiveTab] = useState<ActiveTab>('graph');
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailNodeId, setDetailNodeId]     = useState<string | null>(null);

  // Derive available types from actual data
  const availableTypes = useMemo(() => {
    const seen = new Set<string>();
    entities.forEach(n => seen.add(n.type));
    return Array.from(seen).sort();
  }, [entities]);

  // Auto-activate any newly discovered types
  useEffect(() => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      let changed = false;
      availableTypes.forEach(t => {
        if (!next.has(t)) { next.add(t); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [availableTypes]);
  const graphRef     = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Resize observer — useLayoutEffect so it fires after the DOM layout is settled
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const measure = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) setDimensions({ width, height });
    };
    measure(); // immediate read after layout
    const obs = new ResizeObserver(() => measure());
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Filtered graph data
  const graphData = useMemo(() => {
    const nodes = entities.filter(n => activeTypes.has(n.type));
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = relations.filter(
      l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string)
    ).map(l => ({ ...l })); // clone so d3 can mutate
    return { nodes: nodes.map(n => ({ ...n })), links };
  }, [activeTypes, entities, relations]);

  // Highlight sets for selected node
  const { highlightNodeIds, highlightLinkKeys } = useMemo(() => {
    if (!selectedNodeId) return { highlightNodeIds: new Set<string>(), highlightLinkKeys: new Set<string>() };
    const nodeIds = new Set<string>([selectedNodeId]);
    const linkKeys = new Set<string>();
    relations.forEach(l => {
      const src = l.source as string;
      const tgt = l.target as string;
      if (src === selectedNodeId || tgt === selectedNodeId) {
        nodeIds.add(src);
        nodeIds.add(tgt);
        linkKeys.add(`${src}→${tgt}`);
      }
    });
    return { highlightNodeIds: nodeIds, highlightLinkKeys: linkKeys };
  }, [selectedNodeId, relations]);

  const handleNodeClick = useCallback((node: any) => {
    if (selectedNodeId === node.id) {
      setDetailNodeId(node.id);
    } else {
      setSelectedNodeId(node.id);
      setDetailNodeId(null);
    }
  }, [selectedNodeId]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNodeId(null);
    setDetailNodeId(null);
  }, []);

  const toggleType = (type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
    setSelectedNodeId(null);
    setDetailNodeId(null);
  };

  // Custom node rendering
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected  = node.id === selectedNodeId;
    const isHighlight = highlightNodeIds.has(node.id);
    const isDimmed    = selectedNodeId !== null && !isHighlight;
    const color       = typeColor(node.type, availableTypes);
    const r           = isSelected ? 9 : 6;

    // Glow ring for selected
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 5, 0, 2 * Math.PI);
      ctx.fillStyle = color + '28';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI);
      ctx.fillStyle = color + '50';
      ctx.fill();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = isDimmed ? '#1a2040' : color;
    ctx.fill();

    // Border — neon glow ring for selected, dim for others
    ctx.strokeStyle = isSelected ? color : (isDimmed ? '#2a3060' : color + '80');
    ctx.lineWidth   = isSelected ? 2 : 1;
    ctx.stroke();

    // Label
    const fontSize = Math.max(11 / globalScale, 2.5);
    ctx.font = `${isSelected ? '600 ' : ''}${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isDimmed ? '#2e3a5a' : (isSelected ? '#ffffff' : '#c8d8f0');
    ctx.fillText(node.name, node.x, node.y + r + 2);
  }, [selectedNodeId, highlightNodeIds]);

  const linkColor = useCallback((link: any) => {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    const key = `${src}→${tgt}`;
    if (!selectedNodeId) return '#1e2d50';
    return highlightLinkKeys.has(key) ? '#bf5fff' : '#111828';
  }, [selectedNodeId, highlightLinkKeys]);

  const linkWidth = useCallback((link: any) => {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    const key = `${src}→${tgt}`;
    if (!selectedNodeId) return 1;
    return highlightLinkKeys.has(key) ? 2 : 0.5;
  }, [selectedNodeId, highlightLinkKeys]);

  const detailNode   = entities.find(n => n.id === detailNodeId)   ?? null;
  const selectedNode = entities.find(n => n.id === selectedNodeId) ?? null;

  const connectedNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    return relations
      .filter(l => (l.source as string) === selectedNodeId || (l.target as string) === selectedNodeId)
      .map(l => {
        const src    = l.source as string;
        const tgt    = l.target as string;
        const peerId = src === selectedNodeId ? tgt : src;
        const peer   = entities.find(n => n.id === peerId);
        return peer ? { node: peer, label: l.label, direction: src === selectedNodeId ? 'out' : 'in' as const } : null;
      })
      .filter(Boolean) as { node: NeuronNode; label: string; direction: 'out' | 'in' }[];
  }, [selectedNodeId, relations, entities]);

  // Stats
  const stats = useMemo(() => {
    const visibleNodes = entities.filter(n => activeTypes.has(n.type));
    const visibleIds   = new Set(visibleNodes.map(n => n.id));
    const visibleLinks = relations.filter(l => visibleIds.has(l.source as string) && visibleIds.has(l.target as string));
    return {
      entities:  visibleNodes.length,
      relations: visibleLinks.length,
      types:     activeTypes.size,
    };
  }, [activeTypes, entities, relations]);

  // Build ordered display groups:
  // Order: Business Identity brands → Client Research → Finance Hub → mydb
  const displayGroups = useMemo(() => {
    const map = new Map<string, { title: string; items: DataSource[] }>();

    // Pre-seed fixed origins in desired trailing order
    for (const origin of ['companyresearch', 'financehub', 'userdata']) {
      map.set(origin, { title: FIXED_ORIGIN_LABELS[origin], items: [] });
    }

    // BI brands collected in order of first appearance (will be prepended at end)
    const biGroupOrder: string[] = [];
    const biGroupLabels: Record<string, string> = {};

    for (const s of sources) {
      if (GROUPED_ORIGINS.has(s.origin)) {
        const key   = s.group ?? s.origin;
        const title = s.groupLabel ?? key;
        if (!biGroupLabels[key]) {
          biGroupLabels[key] = title;
          biGroupOrder.push(key);
          map.set(key, { title, items: [] });
        }
        map.get(key)!.items.push(s);
      } else {
        const bucket = map.get(s.origin);
        if (bucket) bucket.items.push(s);
      }
    }

    // Resolve brand name from groupLabel (set by backend from identityJson.companyName)
    for (const key of biGroupOrder) {
      const bucket = map.get(key)!;
      const snapItem = bucket.items.find(i => i.groupLabel);
      if (snapItem?.groupLabel) {
        bucket.title = snapItem.groupLabel;
      }
    }

    // Build final order: BI brands first, then the fixed trailing origins
    const ordered: Array<[string, { title: string; items: DataSource[] }]> = [
      ...biGroupOrder.map(k => [k, map.get(k)!] as [string, { title: string; items: DataSource[] }]),
      ...['companyresearch', 'financehub', 'userdata'].map(k => [k, map.get(k)!] as [string, { title: string; items: DataSource[] }]),
    ];

    return ordered
      .filter(([, v]) => v.items.length > 0)
      .map(([key, v]) => ({ key, ...v }));
  }, [sources]);

  return (
    <div className="neuron-layer">
      {/* ── Toolbar ── */}
      <div className="neuron-toolbar">
        {/* Tab switcher */}
        <div className="neuron-tabs">
          <button
            className={`neuron-tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            Graph
          </button>
          <button
            className={`neuron-tab ${activeTab === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveTab('sources')}
          >
            Data Sources
            {sources.length > 0 && (
              <span className="neuron-tab-badge">{sources.length}</span>
            )}
          </button>
        </div>

        {/* Graph-only controls */}
        {activeTab === 'graph' && (
          <>
            <div className="neuron-type-toggles">
              <span className="neuron-toolbar-label">Concept types</span>
              {availableTypes.length === 0 && !loading && (
                <span className="neuron-toolbar-empty">No concepts yet</span>
              )}
              {availableTypes.map(type => (
                <button
                  key={type}
                  className={`neuron-type-chip ${activeTypes.has(type) ? 'active' : ''}`}
                  style={{ '--chip-color': typeColor(type, availableTypes) } as React.CSSProperties}
                  onClick={() => toggleType(type)}
                >
                  <span className="neuron-type-dot" />
                  {typeLabel(type)}
                </button>
              ))}
            </div>
            <div className="neuron-stats-row">
              <span className="neuron-stat"><strong>{stats.entities}</strong> concepts</span>
              <span className="neuron-stat-sep" />
              <span className="neuron-stat"><strong>{stats.relations}</strong> relations</span>
            </div>
          </>
        )}
      </div>

      {/* ── Body ── */}
      <div className="neuron-body">
        {/* ── Data Sources tab ── */}
        {activeTab === 'sources' && (
          <div className="neuron-sources-panel">
            {sourcesLoading ? (
              <div className="neuron-sources-loading">
                <div className="neuron-graph-spinner" />
              </div>
            ) : sources.length === 0 ? (
              <div className="neuron-sources-empty">
                <div className="neuron-graph-empty-icon">⊞</div>
                <div className="neuron-graph-empty-title">No data sources found</div>
                <div className="neuron-graph-empty-body">
                  Import data from mydb, Finance Hub, or Business Identity to see sources here.
                </div>
              </div>
            ) : (
              displayGroups.map(({ key, title, items }) => (
                <div key={key} className="neuron-sources-group">
                  <div className="neuron-sources-group-title">{title}</div>
                  {items.map(source => {
                    const state = getProcessingState(source);
                    return (
                      <div key={source.id} className={`neuron-source-item state-${state}`}>
                        <span className={`neuron-source-state-dot dot-${state}`} title={
                          state === 'never'     ? 'Not yet processed' :
                          state === 'stale'     ? 'New rows since last processing' :
                          'Processed'
                        } />
                        <div className="neuron-source-item-info">
                          <span className="neuron-source-item-label">{source.label}</span>
                          <span className="neuron-source-item-sublabel">{source.sublabel}</span>
                        </div>
                        {state === 'processed' && source.entityCount > 0 && (
                          <span className="neuron-source-entity-count">
                            {source.entityCount} concepts
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {/* Graph + Side panel */}
        {activeTab === 'graph' && (<>
        <div className="neuron-graph-wrap" ref={containerRef} onClick={(e) => {
          if ((e.target as HTMLElement).closest('canvas')) return;
        }}>
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeId="id"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
            linkLabel="label"
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            cooldownTicks={120}
            d3AlphaDecay={0.03}
            d3VelocityDecay={0.3}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />

          {/* Loading overlay */}
          {loading && (
            <div className="neuron-graph-loading">
              <div className="neuron-graph-spinner" />
            </div>
          )}

          {/* Empty state */}
          {!loading && entities.length === 0 && (
            <div className="neuron-graph-empty">
              <div className="neuron-graph-empty-icon">⬡</div>
              <div className="neuron-graph-empty-title">No concepts yet</div>
              <div className="neuron-graph-empty-body">
                Concepts and relations extracted from your data will appear here.
              </div>
            </div>
          )}

          {/* Hint overlay */}
          {!loading && entities.length > 0 && !selectedNodeId && (
            <div className="neuron-graph-hint">
              Click a node to explore connections
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        {selectedNode && (
          <div className="neuron-side-panel">
            {detailNode ? (
              /* Detail view */
              <>
                <div className="neuron-panel-header">
                  <button className="neuron-panel-back" onClick={() => setDetailNodeId(null)}>← Back</button>
                  <span className="neuron-panel-title">Concept Detail</span>
                </div>
                <div className="neuron-detail-hero" style={{ borderColor: typeColor(detailNode.type, availableTypes) }}>
                  <div
                    className="neuron-detail-type-dot"
                    style={{ background: typeColor(detailNode.type, availableTypes) }}
                  />
                  <div>
                    <div className="neuron-detail-name">{detailNode.name}</div>
                    <div className="neuron-detail-type">{typeLabel(detailNode.type)}</div>
                  </div>
                </div>

                <div className="neuron-panel-section-title">Source Tables</div>
                {detailNode.tables.map(t => (
                  <div key={t} className="neuron-source-row">
                    <span className="neuron-source-icon">⊞</span>
                    <span className="neuron-source-table">{t}</span>
                    <span className="neuron-source-rows">{detailNode.rowCount} rows</span>
                  </div>
                ))}

                <div className="neuron-panel-section-title" style={{ marginTop: 16 }}>Connections</div>
                {connectedNodes.map(({ node, label, direction }) => (
                  <div key={node.id} className="neuron-connection-row">
                    <span
                      className="neuron-connection-dot"
                      style={{ background: typeColor(node.type, availableTypes) }}
                    />
                    <div className="neuron-connection-info">
                      <span className="neuron-connection-name">{node.name}</span>
                      <span className="neuron-connection-label">
                        {direction === 'out' ? `→ ${label}` : `← ${label}`}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              /* Highlight / first-click view */
              <>
                <div className="neuron-panel-header">
                  <span className="neuron-panel-title">Connections</span>
                  <button
                    className="neuron-panel-close"
                    onClick={() => { setSelectedNodeId(null); setDetailNodeId(null); }}
                  >✕</button>
                </div>

                <div className="neuron-selected-hero" style={{ borderColor: typeColor(selectedNode.type, availableTypes) }}>
                  <div
                    className="neuron-detail-type-dot"
                    style={{ background: typeColor(selectedNode.type, availableTypes) }}
                  />
                  <div>
                    <div className="neuron-detail-name">{selectedNode.name}</div>
                    <div className="neuron-detail-type">{typeLabel(selectedNode.type)}</div>
                  </div>
                  <button
                    className="neuron-view-detail-btn"
                    onClick={() => setDetailNodeId(selectedNode.id)}
                  >
                    View Details
                  </button>
                </div>

                <div className="neuron-panel-section-title">
                  {connectedNodes.length} connected {connectedNodes.length === 1 ? 'concept' : 'concepts'}
                </div>
                {connectedNodes.map(({ node, label, direction }) => (
                  <div
                    key={node.id}
                    className="neuron-connection-row clickable"
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      setDetailNodeId(null);
                    }}
                  >
                    <span
                      className="neuron-connection-dot"
                      style={{ background: typeColor(node.type, availableTypes) }}
                    />
                    <div className="neuron-connection-info">
                      <span className="neuron-connection-name">{node.name}</span>
                      <span className="neuron-connection-label">
                        {direction === 'out' ? `→ ${label}` : `← ${label}`}
                      </span>
                    </div>
                    <span
                      className="neuron-connection-type-badge"
                      style={{ color: typeColor(node.type, availableTypes), background: typeColor(node.type, availableTypes) + '18' }}
                    >
                      {typeLabel(node.type)}
                    </span>
                  </div>
                ))}

                <div className="neuron-panel-hint">
                  Click <strong>{selectedNode.name}</strong> again or press "View Details" to see source rows
                </div>
              </>
            )}
          </div>
        )}
        </>)}
      </div>
    </div>
  );
};
