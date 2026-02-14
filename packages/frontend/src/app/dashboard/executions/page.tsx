'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PlayCircle,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatRelativeTime, formatDuration, getStatusColor } from '@/lib/utils';
import { IExecutionSummary, ExecutionStatus } from '@flowforge/shared';

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<IExecutionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | ''>('');

  useEffect(() => {
    loadExecutions();
  }, [statusFilter]);

  async function loadExecutions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get<IExecutionSummary[]>(`/executions?${params}`);
      setExecutions(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoading(false);
    }
  }

  const statusIcon = (status: ExecutionStatus) => {
    switch (status) {
      case 'success': return <CheckCircle size={16} className="text-green-500" />;
      case 'error': return <XCircle size={16} className="text-red-500" />;
      case 'running': return <Loader2 size={16} className="text-blue-500 animate-spin" />;
      case 'pending': return <Clock size={16} className="text-yellow-500" />;
      case 'cancelled': return <XCircle size={16} className="text-gray-400" />;
      default: return <Clock size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Executions</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {total} execution{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <button onClick={loadExecutions} className="btn-secondary">
          <RefreshCw size={16} className="mr-2" />
          Refresh
        </button>
      </div>

      {/* Status filters */}
      <div className="flex gap-2">
        {['', 'success', 'error', 'running', 'pending', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status as ExecutionStatus | '')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              statusFilter === status
                ? 'bg-brand-100 text-brand-700'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
            )}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {/* Executions table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3">
                Status
              </th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3">
                Workflow
              </th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3">
                Mode
              </th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3">
                Duration
              </th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-3">
                Started
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[var(--color-text-muted)]">
                  <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
                  Loading...
                </td>
              </tr>
            ) : executions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[var(--color-text-muted)]">
                  <PlayCircle size={32} className="mx-auto mb-2 opacity-30" />
                  No executions found
                </td>
              </tr>
            ) : (
              executions.map((exec) => (
                <tr
                  key={exec.id}
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {statusIcon(exec.status)}
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          getStatusColor(exec.status)
                        )}
                      >
                        {exec.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{exec.workflowName}</td>
                  <td className="px-4 py-3 text-sm text-[var(--color-text-muted)] capitalize">{exec.mode}</td>
                  <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                    {exec.duration ? formatDuration(exec.duration) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                    {formatRelativeTime(exec.startedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
