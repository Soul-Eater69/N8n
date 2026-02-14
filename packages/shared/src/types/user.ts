export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface IUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IUserCreateInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface IUserUpdateInput {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ILoginInput {
  email: string;
  password: string;
}

export interface ITenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  settings: ITenantSettings;
  createdAt: string;
  updatedAt: string;
}

export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface ITenantSettings {
  maxWorkflows: number;
  maxExecutionsPerMonth: number;
  maxTeamMembers: number;
  retentionDays: number;
  features: string[];
}

export interface ICredential {
  id: string;
  name: string;
  type: string;
  data: Record<string, unknown>;
  tenantId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
