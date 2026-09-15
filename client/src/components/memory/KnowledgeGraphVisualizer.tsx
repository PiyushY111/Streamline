'use client';

import React, { useState, useEffect } from 'react';
import { safeFetch } from '@/lib/api/client';
import {
  Share2,
  Users,
  Building2,
  FolderGit2,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Info,
} from 'lucide-react';

interface GraphNode {
  id: string;
  name: string;
  type: 'person' | 'company' | 'project' | 'topic' | 'decision' | string;
  metadata: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relationType: string;
  weight: number;
}

export function KnowledgeGraphVisualizer() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const res = await safeFetch('/graph');
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      }
    } catch (err) {
      console.warn('Failed to load knowledge graph', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const filteredNodes = nodes.filter((n) => {
    if (filterType !== 'all' && n.type !== filterType) return false;
    if (searchQuery.trim() && !n.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'person':
        return Users;
      case 'company':
        return Building2;
      case 'project':
        return FolderGit2;
      default:
        return Sparkles;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'person':
        return 'bg-purple-500/15 border-purple-500/30 text-purple-400';
      case 'company':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
      case 'project':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
      default:
        return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    }
  };

  const connectedEdges = selectedNode
    ? edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
    : [];

  return (
    <div className="bg-[#141517] border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Enterprise Knowledge Graph (GraphRAG)</h3>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              Recursive CTE Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Traverses people, companies, topics, and cross-thread decisions for relational reasoning.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900/80 border border-slate-700/60 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={fetchGraph}
            disabled={loading}
            className="p-1.5 rounded-xl border border-slate-700/60 hover:bg-slate-800 text-slate-300 transition-colors"
            title="Refresh graph"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Type Filter Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {['all', 'person', 'company', 'project', 'topic'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1 rounded-xl text-xs capitalize transition-all border ${
              filterType === type
                ? 'bg-indigo-600 border-indigo-500 text-white font-medium shadow-md shadow-indigo-500/20'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Graph Node Grid & Inspector Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[380px]">
        {/* Nodes Display */}
        <div className="lg:col-span-2 bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 overflow-y-auto max-h-[460px]">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-indigo-400" />
              Loading relational knowledge graph...
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
              <Share2 className="w-8 h-8 text-slate-600" />
              <p>No graph entities found matching criteria.</p>
              <p className="text-[11px] text-slate-600">Entities are auto-extracted as emails and meetings are ingested.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredNodes.map((node) => {
                const Icon = getNodeIcon(node.type);
                const isSelected = selectedNode?.id === node.id;
                const edgeCount = edges.filter((e) => e.from === node.id || e.to === node.id).length;

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg'
                        : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={`p-2 rounded-lg border ${getNodeColor(node.type)}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">{node.name}</h4>
                          <span className="text-[10px] text-slate-400 capitalize">{node.type}</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono border border-slate-700/60">
                        {edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Entity Inspector Panel */}
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300 mb-3 border-b border-slate-800/80 pb-2">
              <Info className="w-4 h-4 text-indigo-400" />
              <span>Entity Relationship Inspector</span>
            </div>

            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white">{selectedNode.name}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${getNodeColor(selectedNode.type)}`}>
                      {selectedNode.type}
                    </span>
                    <span className="text-[11px] text-slate-500">ID: {selectedNode.id.slice(0, 8)}...</span>
                  </div>
                </div>

                <div>
                  <h5 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Connected Relations ({connectedEdges.length})
                  </h5>
                  {connectedEdges.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No directed edges linked to this node.</p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {connectedEdges.map((edge) => {
                        const targetNode = nodes.find(
                          (n) => n.id === (edge.from === selectedNode.id ? edge.to : edge.from)
                        );
                        const isOutgoing = edge.from === selectedNode.id;

                        return (
                          <div
                            key={edge.id}
                            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2 overflow-hidden">
                              <span className="text-indigo-400 text-[11px] font-mono">
                                {edge.relationType.replace(/_/g, ' ')}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="text-slate-200 truncate">{targetNode?.name || 'Entity'}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">w={edge.weight}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs text-center space-y-1">
                <Share2 className="w-6 h-6 text-slate-600 mb-1" />
                <p>Click any node in the graph to inspect its multi-hop relationships.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
            <span>Powered by PostgreSQL Recursive CTEs & HNSW vector search.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
