import { getDatabase } from '../config/database';
import { generateId, paginate } from '../utils/helpers';

interface AuditLogInput {
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export class AuditService {
  private db = getDatabase();

  async log(input: AuditLogInput): Promise<void> {
    await this.db('audit_logs').insert({
      id: generateId(),
      tenant_id: input.tenantId,
      user_id: input.userId || null,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId || null,
      details: JSON.stringify(input.details || {}),
      ip_address: input.ipAddress || null,
    });
  }

  async getAuditLogs(
    tenantId: string,
    filters: {
      userId?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { offset, limit } = paginate(filters.page || 1, filters.limit || 50);

    let query = this.db('audit_logs')
      .where({ tenant_id: tenantId });

    if (filters.userId) query = query.where({ user_id: filters.userId });
    if (filters.action) query = query.where({ action: filters.action });
    if (filters.resourceType) query = query.where({ resource_type: filters.resourceType });
    if (filters.resourceId) query = query.where({ resource_id: filters.resourceId });
    if (filters.startDate) query = query.where('created_at', '>=', filters.startDate);
    if (filters.endDate) query = query.where('created_at', '<=', filters.endDate);

    const [{ count }] = await query.clone().count();
    const total = parseInt(count as string, 10);

    const logs = await query
      .orderBy('created_at', 'desc')
      .offset(offset)
      .limit(limit);

    return {
      logs: logs.map((log: any) => ({
        id: log.id,
        tenantId: log.tenant_id,
        userId: log.user_id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
        ipAddress: log.ip_address,
        createdAt: log.created_at?.toISOString(),
      })),
      total,
    };
  }
}
