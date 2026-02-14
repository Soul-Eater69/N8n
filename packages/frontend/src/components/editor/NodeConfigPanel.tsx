'use client';

import { useState, useEffect } from 'react';
import { X, Settings, Trash2, Copy, Power } from 'lucide-react';
import { useWorkflowEditorStore, useNodePaletteStore } from '@/lib/store';
import { INodeProperty, IWorkflowNode } from '@flowforge/shared';

interface NodeConfigPanelProps {
  onClose: () => void;
}

export function NodeConfigPanel({ onClose }: NodeConfigPanelProps) {
  const { workflow, selectedNodeId, updateWorkflow, setSelectedNode } =
    useWorkflowEditorStore();
  const { nodeTypes } = useNodePaletteStore();

  const selectedNode = workflow?.nodes.find((n) => n.id === selectedNodeId);
  const nodeTypeDesc = nodeTypes.find((t) => t.type === selectedNode?.type);

  if (!selectedNode || !workflow) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Node Settings</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">Select a node to configure</p>
      </div>
    );
  }

  function updateNode(updates: Partial<IWorkflowNode>) {
    if (!workflow || !selectedNodeId) return;
    updateWorkflow({
      nodes: workflow.nodes.map((n) =>
        n.id === selectedNodeId ? { ...n, ...updates } : n
      ),
    });
  }

  function updateParameter(name: string, value: unknown) {
    if (!selectedNode) return;
    updateNode({
      parameters: { ...selectedNode.parameters, [name]: value },
    });
  }

  function deleteNode() {
    if (!workflow || !selectedNodeId) return;
    updateWorkflow({
      nodes: workflow.nodes.filter((n) => n.id !== selectedNodeId),
      connections: workflow.connections.filter(
        (c) => c.sourceNodeId !== selectedNodeId && c.targetNodeId !== selectedNodeId
      ),
    });
    setSelectedNode(null);
  }

  function duplicateNode() {
    if (!workflow || !selectedNode) return;
    const newNode = {
      ...selectedNode,
      id: `node-${Date.now()}`,
      name: `${selectedNode.name} (Copy)`,
      position: {
        x: selectedNode.position.x + 50,
        y: selectedNode.position.y + 50,
      },
    };
    updateWorkflow({ nodes: [...workflow.nodes, newNode] });
  }

  function shouldShowProperty(prop: INodeProperty): boolean {
    if (!prop.displayOptions) return true;

    if (prop.displayOptions.show) {
      return Object.entries(prop.displayOptions.show).every(([key, values]) => {
        const paramValue = selectedNode?.parameters[key];
        return (values as unknown[]).includes(paramValue);
      });
    }

    if (prop.displayOptions.hide) {
      return !Object.entries(prop.displayOptions.hide).some(([key, values]) => {
        const paramValue = selectedNode?.parameters[key];
        return (values as unknown[]).includes(paramValue);
      });
    }

    return true;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            <Settings size={16} className="inline mr-2" />
            Node Settings
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]">
            <X size={16} />
          </button>
        </div>

        {/* Node name */}
        <input
          type="text"
          value={selectedNode.name}
          onChange={(e) => updateNode({ name: e.target.value })}
          className="input-field text-sm mb-3"
          placeholder="Node name"
        />

        {/* Quick actions */}
        <div className="flex gap-2">
          <button
            onClick={() => updateNode({ disabled: !selectedNode.disabled })}
            className="btn-secondary text-xs flex-1"
          >
            <Power size={14} className="mr-1" />
            {selectedNode.disabled ? 'Enable' : 'Disable'}
          </button>
          <button onClick={duplicateNode} className="btn-secondary text-xs flex-1">
            <Copy size={14} className="mr-1" />
            Duplicate
          </button>
          <button onClick={deleteNode} className="btn-danger text-xs">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Parameters */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          Parameters
        </h4>

        {nodeTypeDesc?.properties.filter(shouldShowProperty).map((prop) => (
          <div key={prop.name}>
            <label className="block text-sm font-medium mb-1">
              {prop.displayName}
              {prop.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {prop.description && (
              <p className="text-xs text-[var(--color-text-muted)] mb-1.5">
                {prop.description}
              </p>
            )}

            {prop.type === 'string' && (
              <input
                type="text"
                value={String(selectedNode.parameters[prop.name] ?? prop.default ?? '')}
                onChange={(e) => updateParameter(prop.name, e.target.value)}
                className="input-field text-sm"
                placeholder={prop.placeholder}
              />
            )}

            {prop.type === 'number' && (
              <input
                type="number"
                value={Number(selectedNode.parameters[prop.name] ?? prop.default ?? 0)}
                onChange={(e) => updateParameter(prop.name, parseInt(e.target.value, 10))}
                className="input-field text-sm"
              />
            )}

            {prop.type === 'boolean' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(selectedNode.parameters[prop.name] ?? prop.default)}
                  onChange={(e) => updateParameter(prop.name, e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm">{prop.displayName}</span>
              </label>
            )}

            {prop.type === 'options' && (
              <select
                value={String(selectedNode.parameters[prop.name] ?? prop.default ?? '')}
                onChange={(e) => updateParameter(prop.name, e.target.value)}
                className="input-field text-sm"
              >
                {prop.options?.map((opt) => (
                  <option key={String(opt.value)} value={String(opt.value)}>
                    {opt.name}
                  </option>
                ))}
              </select>
            )}

            {prop.type === 'json' && (
              <textarea
                value={
                  typeof selectedNode.parameters[prop.name] === 'string'
                    ? (selectedNode.parameters[prop.name] as string)
                    : JSON.stringify(selectedNode.parameters[prop.name] ?? prop.default ?? {}, null, 2)
                }
                onChange={(e) => updateParameter(prop.name, e.target.value)}
                className="input-field text-sm font-mono"
                rows={5}
                placeholder={prop.placeholder}
              />
            )}
          </div>
        ))}

        {/* Retry settings */}
        <div className="border-t border-[var(--color-border)] pt-4">
          <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Error Handling
          </h4>

          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={selectedNode.continueOnFail || false}
              onChange={(e) => updateNode({ continueOnFail: e.target.checked })}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm">Continue on Fail</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={selectedNode.retryOnFail || false}
              onChange={(e) => updateNode({ retryOnFail: e.target.checked })}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm">Retry on Fail</span>
          </label>

          {selectedNode.retryOnFail && (
            <div className="space-y-2 ml-6">
              <div>
                <label className="text-xs text-[var(--color-text-muted)]">Max Retries</label>
                <input
                  type="number"
                  value={selectedNode.maxRetries || 3}
                  onChange={(e) => updateNode({ maxRetries: parseInt(e.target.value, 10) })}
                  className="input-field text-sm"
                  min={1}
                  max={10}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)]">Retry Interval (ms)</label>
                <input
                  type="number"
                  value={selectedNode.retryInterval || 1000}
                  onChange={(e) => updateNode({ retryInterval: parseInt(e.target.value, 10) })}
                  className="input-field text-sm"
                  min={100}
                />
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="border-t border-[var(--color-border)] pt-4">
          <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
            Notes
          </h4>
          <textarea
            value={selectedNode.notes || ''}
            onChange={(e) => updateNode({ notes: e.target.value })}
            className="input-field text-sm"
            rows={3}
            placeholder="Add notes about this node..."
          />
        </div>
      </div>
    </div>
  );
}
