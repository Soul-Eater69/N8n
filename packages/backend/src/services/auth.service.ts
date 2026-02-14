import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDatabase } from '../config/database';
import { generateId } from '../utils/helpers';
import { UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors';
import { IUser, IAuthTokens, IUserCreateInput, UserRole } from '@flowforge/shared';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 12;

export class AuthService {
  private db = getDatabase();

  async register(
    input: IUserCreateInput,
    tenantId: string
  ): Promise<{ user: IUser; tokens: IAuthTokens }> {
    const existing = await this.db('users')
      .where({ email: input.email, tenant_id: tenantId })
      .first();

    if (existing) {
      throw new ConflictError('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const id = generateId();

    const [user] = await this.db('users')
      .insert({
        id,
        email: input.email,
        password_hash: passwordHash,
        first_name: input.firstName,
        last_name: input.lastName,
        role: input.role || 'member',
        tenant_id: tenantId,
      })
      .returning('*');

    const tokens = this.generateTokens(user);

    logger.info({ userId: id, tenantId }, 'User registered');

    return {
      user: this.mapUser(user),
      tokens,
    };
  }

  async login(email: string, password: string, tenantId: string): Promise<{ user: IUser; tokens: IAuthTokens }> {
    const user = await this.db('users')
      .where({ email, tenant_id: tenantId })
      .first();

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Account is deactivated');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.db('users')
      .where({ id: user.id })
      .update({ last_login_at: new Date() });

    const tokens = this.generateTokens(user);

    logger.info({ userId: user.id, tenantId }, 'User logged in');

    return {
      user: this.mapUser(user),
      tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<IAuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as {
        id: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const user = await this.db('users').where({ id: decoded.id }).first();
      if (!user || !user.is_active) {
        throw new UnauthorizedError('User not found or inactive');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  async getUserById(id: string, tenantId: string): Promise<IUser> {
    const user = await this.db('users')
      .where({ id, tenant_id: tenantId })
      .first();

    if (!user) throw new NotFoundError('User', id);
    return this.mapUser(user);
  }

  async getUsers(tenantId: string): Promise<IUser[]> {
    const users = await this.db('users').where({ tenant_id: tenantId }).orderBy('created_at', 'desc');
    return users.map(this.mapUser);
  }

  async updateUserRole(userId: string, role: UserRole, tenantId: string): Promise<IUser> {
    const [user] = await this.db('users')
      .where({ id: userId, tenant_id: tenantId })
      .update({ role, updated_at: new Date() })
      .returning('*');

    if (!user) throw new NotFoundError('User', userId);
    return this.mapUser(user);
  }

  private generateTokens(user: any): IAuthTokens {
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        type: 'access',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiry }
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshTokenExpiry }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
    };
  }

  private mapUser(row: any): IUser {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      tenantId: row.tenant_id,
      isActive: row.is_active,
      lastLoginAt: row.last_login_at?.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export class TenantService {
  private db = getDatabase();

  async createTenant(name: string, slug: string, ownerInput: IUserCreateInput) {
    const existing = await this.db('tenants').where({ slug }).first();
    if (existing) {
      throw new ConflictError('Tenant with this slug already exists');
    }

    const tenantId = generateId();

    return this.db.transaction(async (trx) => {
      const [tenant] = await trx('tenants')
        .insert({
          id: tenantId,
          name,
          slug,
          plan: 'free',
          settings: JSON.stringify({
            maxWorkflows: 5,
            maxExecutionsPerMonth: 500,
            maxTeamMembers: 1,
            retentionDays: 7,
            features: [],
          }),
        })
        .returning('*');

      const passwordHash = await bcrypt.hash(ownerInput.password, SALT_ROUNDS);

      const [owner] = await trx('users')
        .insert({
          id: generateId(),
          email: ownerInput.email,
          password_hash: passwordHash,
          first_name: ownerInput.firstName,
          last_name: ownerInput.lastName,
          role: 'owner',
          tenant_id: tenantId,
        })
        .returning('*');

      logger.info({ tenantId, slug }, 'Tenant created');

      return { tenant, owner };
    });
  }

  async getTenantById(id: string) {
    const tenant = await this.db('tenants').where({ id }).first();
    if (!tenant) throw new NotFoundError('Tenant', id);
    return tenant;
  }
}
