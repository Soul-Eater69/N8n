import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/database';
import { config } from '../config';
import { generateId } from '../utils/helpers';
import { UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors';
import { IUser, IAuthTokens } from '@stagerush/shared';

export class AuthService {
  private db = getDb();

  async register(email: string, password: string, firstName: string, lastName: string): Promise<{ user: IUser; tokens: IAuthTokens }> {
    const existing = await this.db('users').where({ email }).first();
    if (existing) throw new ConflictError('Email already registered');

    const id = generateId();
    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await this.db('users')
      .insert({ id, email, password_hash: passwordHash, first_name: firstName, last_name: lastName })
      .returning('*');

    return { user: this.map(user), tokens: this.generateTokens(user) };
  }

  async login(email: string, password: string): Promise<{ user: IUser; tokens: IAuthTokens }> {
    const user = await this.db('users').where({ email }).first();
    if (!user) throw new UnauthorizedError('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedError('Invalid credentials');

    return { user: this.map(user), tokens: this.generateTokens(user) };
  }

  async getById(id: string): Promise<IUser> {
    const user = await this.db('users').where({ id }).first();
    if (!user) throw new NotFoundError('User', id);
    return this.map(user);
  }

  private generateTokens(user: any): IAuthTokens {
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiry }
    );
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiry }
    );
    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private map(r: any): IUser {
    return {
      id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name,
      phone: r.phone, role: r.role, isVerified: r.is_verified, createdAt: r.created_at?.toISOString(),
    };
  }
}
