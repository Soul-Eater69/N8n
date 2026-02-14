'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Save,
  Play,
  ArrowLeft,
  Plus,
  Settings,
  Maximize2,
  Undo2,
  Redo2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkflowEditorStore } from '@/lib/store';
import { WorkflowCanvas } from '@/components/editor/WorkflowCanvas';
import { NodePalette } from '@/components/editor/NodePalette';
import { NodeConfigPanel } from '@/components/editor/NodeConfigPanel';
import { cn } from '@/lib/utils';

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  const isNew = workflowId === 'new';

  const { workflow, isDirty, isExecuting, setWorkflow, setIsExecuting } =
    useWorkflowEditorStore();
  const [showPalette, setShowPalette] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setWorkflow({
        id: '',
        name: 'New Workflow',
        description: '',
        nodes: [],
        connections: [],
        settings: {},
        status: 'draft',
        tags: [],
        tenantId: '',
        createdBy: '',
        updatedBy: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      });
    } else {
      loadWorkflow();
    }
  }, [workflowId]);

  async function loadWorkflow() {
    try {
      const res = await api.get<any>(`/workflows/${workflowId}`);
      if (res.success && res.data) {
        setWorkflow(res.data);
      }
    } catch (err) {
      console.error('Failed to load workflow:', err);
      router.push('/dashboard/workflows');
    }
  }

  async function handleSave() {
    if (!workflow) return;
    setSaving(true);
    try {
      if (isNew) {
        const res = await api.post<any>('/workflows', {
          name: workflow.name,
          description: workflow.description,
          nodes: workflow.nodes,
          connections: workflow.connections,
          settings: workflow.settings,
        });
        if (res.success && res.data) {
          router.push(`/dashboard/workflows/${res.data.id}`);
        }
      } else {
        await api.put(`/workflows/${workflowId}`, {
          name: workflow.name,
          description: workflow.description,
          nodes: workflow.nodes,
          connections: workflow.connections,
          settings: workflow.settings,
        });
        setWorkflow({ ...workflow });
      }
    } catch (err) {
      console.error('Failed to save workflow:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleExecute() {
    if (!workflowId || isNew) return;
    setIsExecuting(true);
    try {
      const res = await api.post<any>(`/workflows/${workflowId}/execute`);
      if (res.success && res.data) {
        // Could navigate to execution detail or show inline
      }
    } catch (err) {
      console.error('Failed to execute workflow:', err);
    } finally {
      setIsExecuting(false);
    }
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-[var(--color-text-muted)]">Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[var(--color-bg-primary)] z-50 flex flex-col">
      {/* Toolbar */}
      <div className="h-14 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/workflows')}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>

          <input
            type="text"
            value={workflow.name}
            onChange={(e) =>
              useWorkflowEditorStore.getState().updateWorkflow({ name: e.target.value })
            }
            className="text-lg font-semibold bg-transparent border-none outline-none focus:ring-0 w-64"
            placeholder="Workflow name"
          />

          {isDirty && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
              Unsaved
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className={cn(
              'btn-secondary text-sm',
              showPalette && 'bg-brand-50 border-brand-300'
            )}
          >
            <Plus size={16} className="mr-1.5" />
            Add Node
          </button>

          <button onClick={handleSave} className="btn-secondary text-sm" disabled={saving}>
            <Save size={16} className="mr-1.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>

          <button
            onClick={handleExecute}
            className="btn-primary text-sm"
            disabled={isNew || isExecuting}
          >
            <Play size={16} className="mr-1.5" />
            {isExecuting ? 'Running...' : 'Execute'}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node Palette */}
        {showPalette && (
          <div className="w-72 border-r border-[var(--color-border)] overflow-y-auto bg-[var(--color-bg-primary)]">
            <NodePalette onClose={() => setShowPalette(false)} />
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 relative">
          <WorkflowCanvas />
        </div>

        {/* Config Panel */}
        {showConfig && (
          <div className="w-80 border-l border-[var(--color-border)] overflow-y-auto bg-[var(--color-bg-primary)]">
            <NodeConfigPanel onClose={() => setShowConfig(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
