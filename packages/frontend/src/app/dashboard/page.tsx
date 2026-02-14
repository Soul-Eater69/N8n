'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GitBranch,
  PlayCircle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatRelativeTime, getStatusColor } from '@/lib/utils';

interface DashboardStats {
  totalWorkflows: number;
  activeWorkflows: number;
  recentExecutions: any[];
  executionStats: any;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalWorkflows: 0,
    activeWorkflows: 0,
    recentExecutions: [],
    executionStats: { byStatus: {} },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [workflowsRes, executionsRes, statsRes] = await Promise.all([
        api.get<any>('/workflows?limit=5'),
        api.get<any>('/executions?limit=10'),
        api.get<any>('/executions/stats/overview?days=30'),
      ]);

      setStats({
        totalWorkflows: workflowsRes.meta?.total || 0,
        activeWorkflows: (workflowsRes.data || []).filter((w: any) => w.status === 'active').length,
        recentExecutions: executionsRes.data || [],
        executionStats: statsRes.data || { byStatus: {} },
      });
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: 'Total Workflows',
      value: stats.totalWorkflows,
      icon: GitBranch,
      color: 'text-brand-600',
      bgColor: 'bg-brand-50',
    },
    {
      title: 'Active Workflows',
      value: stats.activeWorkflows,
      icon: PlayCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Successful',
      value: stats.executionStats?.byStatus?.success || 0,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Failed',
      value: stats.executionStats?.byStatus?.error || 0,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Overview of your workflow automations
          </p>
        </div>
        <Link href="/dashboard/workflows/new" className="btn-primary">
          <Plus size={18} className="mr-2" />
          New Workflow
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="card flex items-center gap-4">
            <div className={cn('p-3 rounded-xl', card.bgColor)}>
              <card.icon className={cn('h-6 w-6', card.color)} />
            </div>
            <div>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-sm text-[var(--color-text-muted)]">{card.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Executions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Executions</h2>
          <Link
            href="/dashboard/executions"
            className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {stats.recentExecutions.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <PlayCircle size={48} className="mx-auto mb-3 opacity-30" />
            <p>No executions yet</p>
            <p className="text-sm">Execute a workflow to see results here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentExecutions.map((execution: any) => (
              <Link
                key={execution.id}
                href={`/dashboard/executions/${execution.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      getStatusColor(execution.status)
                    )}
                  >
                    {execution.status}
                  </span>
                  <span className="text-sm font-medium">
                    {execution.workflowName}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {execution.duration ? `${(execution.duration / 1000).toFixed(1)}s` : '-'}
                  </span>
                  <span>{formatRelativeTime(execution.startedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/workflows/new" className="card hover:border-brand-300 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-50 group-hover:bg-brand-100 transition-colors">
              <Plus className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <div className="font-medium">Create Workflow</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Build a new automation
              </div>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/credentials" className="card hover:border-brand-300 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 group-hover:bg-purple-100 transition-colors">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="font-medium">Manage Credentials</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Add API keys and secrets
              </div>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/team" className="card hover:border-brand-300 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 group-hover:bg-green-100 transition-colors">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="font-medium">Invite Team</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                Collaborate with your team
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
