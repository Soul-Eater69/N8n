import { getDatabase } from '../config/database';
import { generateId, paginate } from '../utils/helpers';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import {
  IWorkflow,
  IWorkflowCreateInput,
  IWorkflowUpdateInput,
  IPaginationQuery,
} from '@flowforge/shared';
import { logger } from '../utils/logger';
import { AuditService } from './audit.service';

export class WorkflowService {
  private db = getDatabase();
  private auditService = new AuditService();

  async create(input: IWorkflowCreateInput, userId: string, tenantId: string): Promise<IWorkflow> {
    const id = generateId();

    const [workflow] = await this.db('workflows')
      .insert({
        id,
        name: input.name,
        description: input.description || null,
        nodes: JSON.stringify(input.nodes || []),
        connections: JSON.stringify(input.connections || []),
        settings: JSON.stringify(input.settings || {}),
        tags: input.tags || [],
        tenant_id: tenantId,
        created_by: userId,
        updated_by: userId,
      })
      .returning('*');

    await this.auditService.log({
      tenantId,
      userId,
      action: 'workflow.created',
      resourceType: 'workflow',
      resourceId: id,
      details: { name: input.name },
    });

    logger.info({ workflowId: id, tenantId }, 'Workflow created');
    return this.mapWorkflow(workflow);
  }

  async getById(id: string, tenantId: string): Promise<IWorkflow> {
    const workflow = await this.db('workflows')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!workflow) throw new NotFoundError('Workflow', id);
    return this.mapWorkflow(workflow);
  }

  async list(tenantId: string, query: IPaginationQuery): Promise<{ workflows: IWorkflow[]; total: number }> {
    const { offset, limit, page } = paginate(query.page || 1, query.limit || 20);

    let baseQuery = this.db('workflows').where({ tenant_id: tenantId });

    if (query.search) {
      baseQuery = baseQuery.where((builder) => {
        builder.where('name', 'ilike', `%${query.search}%`)
          .orWhere('description', 'ilike', `%${query.search}%`);
      });
    }

    const [{ count }] = await baseQuery.clone().count();
    const total = parseInt(count as string, 10);

    const workflows = await baseQuery
      .orderBy(query.sortBy || 'updated_at', query.sortOrder || 'desc')
      .offset(offset)
      .limit(limit);

    return {
      workflows: workflows.map(this.mapWorkflow),
      total,
    };
  }

  async update(id: string, input: IWorkflowUpdateInput, userId: string, tenantId: string): Promise<IWorkflow> {
    const existing = await this.db('workflows')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!existing) throw new NotFoundError('Workflow', id);

    // Save version history
    await this.db('workflow_versions').insert({
      id: generateId(),
      workflow_id: id,
      version: existing.version,
      nodes: existing.nodes,
      connections: existing.connections,
      settings: existing.settings,
      created_by: userId,
      change_description: 'Auto-saved before update',
    });

    const updateData: Record<string, unknown> = {
      updated_by: userId,
      updated_at: new Date(),
      version: existing.version + 1,
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.nodes !== undefined) updateData.nodes = JSON.stringify(input.nodes);
    if (input.connections !== undefined) updateData.connections = JSON.stringify(input.connections);
    if (input.settings !== undefined) updateData.settings = JSON.stringify(input.settings);
    if (input.status !== undefined) updateData.status = input.status;
    if (input.tags !== undefined) updateData.tags = input.tags;

    const [workflow] = await this.db('workflows')
      .where({ id, tenant_id: tenantId })
      .update(updateData)
      .returning('*');

    await this.auditService.log({
      tenantId,
      userId,
      action: 'workflow.updated',
      resourceType: 'workflow',
      resourceId: id,
      details: { version: workflow.version },
    });

    return this.mapWorkflow(workflow);
  }

  async delete(id: string, userId: string, tenantId: string): Promise<void> {
    const workflow = await this.db('workflows')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!workflow) throw new NotFoundError('Workflow', id);

    if (workflow.status === 'active') {
      throw new ValidationError('Cannot delete an active workflow. Deactivate it first.');
    }

    await this.db('workflows').where({ id, tenant_id: tenantId }).delete();

    await this.auditService.log({
      tenantId,
      userId,
      action: 'workflow.deleted',
      resourceType: 'workflow',
      resourceId: id,
      details: { name: workflow.name },
    });

    logger.info({ workflowId: id, tenantId }, 'Workflow deleted');
  }

  async activate(id: string, userId: string, tenantId: string): Promise<IWorkflow> {
    return this.update(id, { status: 'active' }, userId, tenantId);
  }

  async deactivate(id: string, userId: string, tenantId: string): Promise<IWorkflow> {
    return this.update(id, { status: 'inactive' }, userId, tenantId);
  }

  async getVersionHistory(workflowId: string, tenantId: string) {
    const workflow = await this.db('workflows')
      .where({ id: workflowId, tenant_id: tenantId })
      .first();
    if (!workflow) throw new NotFoundError('Workflow', workflowId);

    return this.db('workflow_versions')
      .where({ workflow_id: workflowId })
      .orderBy('version', 'desc')
      .limit(50);
  }

  private mapWorkflow(row: any): IWorkflow {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
      connections: typeof row.connections === 'string' ? JSON.parse(row.connections) : row.connections,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
      status: row.status,
      tags: row.tags || [],
      tenantId: row.tenant_id,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
      version: row.version,
    };
  }
}
