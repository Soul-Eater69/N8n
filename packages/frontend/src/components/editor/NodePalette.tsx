'use client';

import { useState, useEffect } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkflowEditorStore, useNodePaletteStore } from '@/lib/store';
import { INodeTypeDescription } from '@flowforge/shared';
import { cn } from '@/lib/utils';

const categoryLabels: Record<string, string> = {
  triggers: 'Triggers',
  logic: 'Logic & Flow',
  actions: 'Actions',
  transform: 'Data Transform',
  utility: 'Utilities',
  integration: 'Integrations',
  ai: 'AI & ML',
};

const categoryColors: Record<string, string> = {
  triggers: 'bg-green-100 text-green-700',
  logic: 'bg-yellow-100 text-yellow-700',
  actions: 'bg-blue-100 text-blue-700',
  transform: 'bg-purple-100 text-purple-700',
  utility: 'bg-gray-100 text-gray-700',
  integration: 'bg-orange-100 text-orange-700',
  ai: 'bg-pink-100 text-pink-700',
};

interface NodePaletteProps {
  onClose: () => void;
}

export function NodePalette({ onClose }: NodePaletteProps) {
  const { nodeTypes, setNodeTypes, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory } =
    useNodePaletteStore();
  const { workflow, updateWorkflow } = useWorkflowEditorStore();

  useEffect(() => {
    if (nodeTypes.length === 0) {
      loadNodeTypes();
    }
  }, []);

  async function loadNodeTypes() {
    try {
      const res = await api.get<INodeTypeDescription[]>('/nodes');
      if (res.data) {
        setNodeTypes(res.data);
      }
    } catch (err) {
      console.error('Failed to load node types:', err);
    }
  }

  function addNode(nodeType: INodeTypeDescription) {
    if (!workflow) return;

    const newNode = {
      id: `node-${Date.now()}`,
      type: nodeType.type,
      name: nodeType.displayName,
      position: {
        x: 250 + Math.random() * 200,
        y: 150 + Math.random() * 200,
      },
      parameters: Object.fromEntries(
        nodeType.properties.map((p) => [p.name, p.default])
      ),
    };

    updateWorkflow({
      nodes: [...workflow.nodes, newNode],
    });
  }

  const filteredNodes = nodeTypes.filter((node) => {
    const matchesSearch =
      !searchQuery ||
      node.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !selectedCategory || node.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const groupedNodes = filteredNodes.reduce((acc, node) => {
    if (!acc[node.category]) acc[node.category] = [];
    acc[node.category].push(node);
    return acc;
  }, {} as Record<string, INodeTypeDescription[]>);

  const categories = Object.keys(categoryLabels);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Add Node</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            placeholder="Search nodes..."
            className="input-field pl-9 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'text-xs px-2 py-1 rounded-full transition-colors',
              !selectedCategory
                ? 'bg-brand-100 text-brand-700'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={cn(
                'text-xs px-2 py-1 rounded-full transition-colors',
                selectedCategory === cat
                  ? categoryColors[cat]
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'
              )}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groupedNodes).map(([category, nodes]) => (
          <div key={category}>
            <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              {categoryLabels[category] || category}
            </h4>
            <div className="space-y-1.5">
              {nodes.map((node) => (
                <button
                  key={node.type}
                  onClick={() => addNode(node)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors text-left group"
                >
                  <div
                    className={cn(
                      'p-1.5 rounded-lg text-xs',
                      categoryColors[category] || 'bg-gray-100 text-gray-700'
                    )}
                  >
                    <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {node.displayName}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] truncate">
                      {node.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredNodes.length === 0 && (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <p className="text-sm">No nodes found</p>
          </div>
        )}
      </div>
    </div>
  );
}
