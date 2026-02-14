'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  GitBranch,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatRelativeTime, getStatusColor } from '@/lib/utils';
import { IWorkflow } from '@flowforge/shared';

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<IWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadWorkflows();
  }, [search]);

  async function loadWorkflows() {
    try {
      const res = await api.get<IWorkflow[]>(`/workflows?search=${search}&limit=50`);
      setWorkflows(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleWorkflow(workflow: IWorkflow, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const endpoint = workflow.status === 'active' ? 'deactivate' : 'activate';
      await api.post(`/workflows/${workflow.id}/${endpoint}`);
      loadWorkflows();
    } catch (err) {
      console.error('Failed to toggle workflow:', err);
    }
  }

  async function deleteWorkflow(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await api.delete(`/workflows/${id}`);
      loadWorkflows();
    } catch (err) {
      console.error('Failed to delete workflow:', err);
    }
  }

  async function executeWorkflow(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await api.post<any>(`/workflows/${id}/execute`);
      if (res.success && res.data) {
        router.push(`/dashboard/executions/${res.data.id}`);
      }
    } catch (err) {
      console.error('Failed to execute workflow:', err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {total} workflow{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link href="/dashboard/workflows/new" className="btn-primary">
          <Plus size={18} className="mr-2" />
          New Workflow
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="text"
          placeholder="Search workflows..."
          className="input-field pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Workflow List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-20" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="card text-center py-12">
          <GitBranch size={48} className="mx-auto mb-4 text-[var(--color-text-muted)] opacity-30" />
          <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
          <p className="text-[var(--color-text-muted)] mb-4">
            Create your first workflow to get started with automation
          </p>
          <Link href="/dashboard/workflows/new" className="btn-primary">
            <Plus size={18} className="mr-2" />
            Create Workflow
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <Link
              key={workflow.id}
              href={`/dashboard/workflows/${workflow.id}`}
              className="card flex items-center justify-between hover:border-brand-300 transition-colors p-4"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-brand-50">
                  <GitBranch className="h-5 w-5 text-brand-600" />
                </div>
                <div>
                  <div className="font-medium">{workflow.name}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                        getStatusColor(workflow.status)
                      )}
                    >
                      {workflow.status}
                    </span>
                    {workflow.description && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {workflow.description.substring(0, 60)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                  <Clock size={12} />
                  {formatRelativeTime(workflow.updatedAt)}
                </span>

                <button
                  onClick={(e) => executeWorkflow(workflow.id, e)}
                  className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                  title="Execute"
                >
                  <Play size={16} />
                </button>

                <button
                  onClick={(e) => toggleWorkflow(workflow, e)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    workflow.status === 'active'
                      ? 'hover:bg-yellow-50 text-yellow-600'
                      : 'hover:bg-green-50 text-green-600'
                  )}
                  title={workflow.status === 'active' ? 'Deactivate' : 'Activate'}
                >
                  {workflow.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                </button>

                <button
                  onClick={(e) => deleteWorkflow(workflow.id, e)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
