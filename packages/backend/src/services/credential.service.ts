import { getDatabase } from '../config/database';
import { encrypt, decrypt } from '../utils/encryption';
import { generateId } from '../utils/helpers';
import { NotFoundError } from '../utils/errors';
import { ICredential } from '@flowforge/shared';
import { AuditService } from './audit.service';

export class CredentialService {
  private db = getDatabase();
  private auditService = new AuditService();

  async create(
    name: string,
    type: string,
    data: Record<string, unknown>,
    userId: string,
    tenantId: string
  ): Promise<ICredential> {
    const id = generateId();
    const encryptedData = encrypt(JSON.stringify(data));

    const [credential] = await this.db('credentials')
      .insert({
        id,
        name,
        type,
        data_encrypted: encryptedData,
        tenant_id: tenantId,
        created_by: userId,
      })
      .returning('*');

    await this.auditService.log({
      tenantId,
      userId,
      action: 'credential.created',
      resourceType: 'credential',
      resourceId: id,
      details: { name, type },
    });

    return this.mapCredential(credential, false);
  }

  async getById(id: string, tenantId: string, includeData = false): Promise<ICredential> {
    const credential = await this.db('credentials')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!credential) throw new NotFoundError('Credential', id);
    return this.mapCredential(credential, includeData);
  }

  async list(tenantId: string): Promise<ICredential[]> {
    const credentials = await this.db('credentials')
      .where({ tenant_id: tenantId })
      .orderBy('created_at', 'desc');

    return credentials.map((c: any) => this.mapCredential(c, false));
  }

  async update(
    id: string,
    name: string,
    data: Record<string, unknown>,
    userId: string,
    tenantId: string
  ): Promise<ICredential> {
    const encryptedData = encrypt(JSON.stringify(data));

    const [credential] = await this.db('credentials')
      .where({ id, tenant_id: tenantId })
      .update({
        name,
        data_encrypted: encryptedData,
        updated_at: new Date(),
      })
      .returning('*');

    if (!credential) throw new NotFoundError('Credential', id);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'credential.updated',
      resourceType: 'credential',
      resourceId: id,
    });

    return this.mapCredential(credential, false);
  }

  async delete(id: string, userId: string, tenantId: string): Promise<void> {
    const result = await this.db('credentials')
      .where({ id, tenant_id: tenantId })
      .delete();

    if (!result) throw new NotFoundError('Credential', id);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'credential.deleted',
      resourceType: 'credential',
      resourceId: id,
    });
  }

  async getDecryptedData(id: string, tenantId: string): Promise<Record<string, unknown>> {
    const credential = await this.db('credentials')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!credential) throw new NotFoundError('Credential', id);

    return JSON.parse(decrypt(credential.data_encrypted));
  }

  private mapCredential(row: any, includeData: boolean): ICredential {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      data: includeData ? JSON.parse(decrypt(row.data_encrypted)) : {},
      tenantId: row.tenant_id,
      createdBy: row.created_by,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    };
  }
}
