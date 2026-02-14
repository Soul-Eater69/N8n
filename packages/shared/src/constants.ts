export const PLAN_LIMITS: Record<string, { maxWorkflows: number; maxExecutionsPerMonth: number; maxTeamMembers: number; retentionDays: number }> = {
  free: {
    maxWorkflows: 5,
    maxExecutionsPerMonth: 500,
    maxTeamMembers: 1,
    retentionDays: 7,
  },
  starter: {
    maxWorkflows: 25,
    maxExecutionsPerMonth: 5000,
    maxTeamMembers: 5,
    retentionDays: 30,
  },
  professional: {
    maxWorkflows: 100,
    maxExecutionsPerMonth: 50000,
    maxTeamMembers: 25,
    retentionDays: 90,
  },
  enterprise: {
    maxWorkflows: -1,
    maxExecutionsPerMonth: -1,
    maxTeamMembers: -1,
    retentionDays: 365,
  },
};

export const EXECUTION_TIMEOUT_DEFAULT = 300000; // 5 minutes
export const EXECUTION_TIMEOUT_MAX = 3600000; // 1 hour
export const MAX_PAYLOAD_SIZE = '16mb';
export const WEBHOOK_PATH_PREFIX = '/webhooks';
export const API_VERSION = 'v1';
