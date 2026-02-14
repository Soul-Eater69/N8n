import { getDatabase } from '../config/database';
import { generateId, paginate } from '../utils/helpers';
import { NotFoundError } from '../utils/errors';
import {
  IExecution,
  IExecutionSummary,
  IExecutionFilters,
  ExecutionStatus,
} from '@flowforge/shared';
import { logger } from '../utils/logger';

export class ExecutionService {
  private db = getDatabase();

  async create(
    workflowId: string,
    tenantId: string,
    mode: string,
    triggeredBy?: string
  ): Promise<IExecution> {
    const id = generateId();

    const [execution] = await this.db('executions')
      .insert({
        id,
        workflow_id: workflowId,
        status: 'pending',
        mode,
        data: JSON.stringify({
          nodeExecutionOrder: [],
          nodeResults: {},
        }),
        tenant_id: tenantId,
        triggered_by: triggeredBy || null,
      })
      .returning('*');

    logger.info({ executionId: id, workflowId, mode }, 'Execution created');
    return this.mapExecution(execution);
  }

  async getById(id: string, tenantId: string): Promise<IExecution> {
    const execution = await this.db('executions')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!execution) throw new NotFoundError('Execution', id);
    return this.mapExecution(execution);
  }

  async list(
    tenantId: string,
    filters: IExecutionFilters
  ): Promise<{ executions: IExecutionSummary[]; total: number }> {
    const { offset, limit } = paginate(
      Math.floor((filters.offset || 0) / (filters.limit || 20)) + 1,
      filters.limit || 20
    );

    let query = this.db('executions')
      .where({ 'executions.tenant_id': tenantId })
      .leftJoin('workflows', 'executions.workflow_id', 'workflows.id');

    if (filters.workflowId) query = query.where({ 'executions.workflow_id': filters.workflowId });
    if (filters.status) query = query.where({ 'executions.status': filters.status });
    if (filters.mode) query = query.where({ 'executions.mode': filters.mode });
    if (filters.startedAfter) query = query.where('executions.started_at', '>=', filters.startedAfter);
    if (filters.startedBefore) query = query.where('executions.started_at', '<=', filters.startedBefore);

    const [{ count }] = await query.clone().count();
    const total = parseInt(count as string, 10);

    const executions = await query
      .select(
        'executions.id',
        'executions.workflow_id',
        'workflows.name as workflow_name',
        'executions.status',
        'executions.mode',
        'executions.started_at',
        'executions.finished_at',
        'executions.error'
      )
      .orderBy('executions.started_at', 'desc')
      .offset(offset)
      .limit(limit);

    return {
      executions: executions.map((e: any) => ({
        id: e.id,
        workflowId: e.workflow_id,
        workflowName: e.workflow_name || 'Unknown',
        status: e.status,
        mode: e.mode,
        startedAt: e.started_at?.toISOString(),
        finishedAt: e.finished_at?.toISOString(),
        duration: e.finished_at && e.started_at
          ? new Date(e.finished_at).getTime() - new Date(e.started_at).getTime()
          : undefined,
        nodeCount: 0,
        error: e.error?.message,
      })),
      total,
    };
  }

  async updateStatus(
    id: string,
    status: ExecutionStatus,
    data?: Record<string, unknown>
  ): Promise<void> {
    const update: Record<string, unknown> = { status };

    if (status === 'running') {
      update.started_at = new Date();
    }

    if (['success', 'error', 'cancelled'].includes(status)) {
      update.finished_at = new Date();
    }

    if (data) {
      update.data = JSON.stringify(data);
    }

    await this.db('executions').where({ id }).update(update);
  }

  async setError(id: string, error: { message: string; nodeId?: string; stack?: string }): Promise<void> {
    await this.db('executions')
      .where({ id })
      .update({
        status: 'error',
        error: JSON.stringify(error),
        finished_at: new Date(),
      });
  }

  async cancel(id: string, tenantId: string): Promise<void> {
    const execution = await this.db('executions')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!execution) throw new NotFoundError('Execution', id);

    if (!['pending', 'running', 'waiting'].includes(execution.status)) {
      return; // Already finished
    }

    await this.updateStatus(id, 'cancelled');
    logger.info({ executionId: id }, 'Execution cancelled');
  }

  async getStats(tenantId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const stats = await this.db('executions')
      .where({ tenant_id: tenantId })
      .where('started_at', '>=', since)
      .select(this.db.raw('status, count(*)::int as count'))
      .groupBy('status');

    const dailyStats = await this.db('executions')
      .where({ tenant_id: tenantId })
      .where('started_at', '>=', since)
      .select(
        this.db.raw("date_trunc('day', started_at) as date"),
        this.db.raw('count(*)::int as total'),
        this.db.raw("count(*) filter (where status = 'success')::int as success"),
        this.db.raw("count(*) filter (where status = 'error')::int as errors")
      )
      .groupBy(this.db.raw("date_trunc('day', started_at)"))
      .orderBy('date', 'asc');

    return {
      byStatus: stats.reduce((acc: any, s: any) => ({ ...acc, [s.status]: s.count }), {}),
      daily: dailyStats.map((d: any) => ({
        date: d.date?.toISOString(),
        total: d.total,
        success: d.success,
        errors: d.errors,
      })),
    };
  }

  async cleanup(tenantId: string, retentionDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const deleted = await this.db('executions')
      .where({ tenant_id: tenantId })
      .where('started_at', '<', cutoff)
      .whereIn('status', ['success', 'error', 'cancelled'])
      .delete();

    logger.info({ tenantId, deleted, retentionDays }, 'Execution cleanup completed');
    return deleted;
  }

  private mapExecution(row: any): IExecution {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      mode: row.mode,
      startedAt: row.started_at?.toISOString(),
      finishedAt: row.finished_at?.toISOString(),
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      error: row.error ? (typeof row.error === 'string' ? JSON.parse(row.error) : row.error) : undefined,
      retryOf: row.retry_of,
      retrySuccessId: row.retry_success_id,
      tenantId: row.tenant_id,
      triggeredBy: row.triggered_by,
      workerId: row.worker_id,
    };
  }
}
