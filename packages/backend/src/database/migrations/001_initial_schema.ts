import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Tenants table (multi-tenancy)
  await knex.schema.createTable('tenants', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name').notNullable();
    table.string('slug').notNullable().unique();
    table.enum('plan', ['free', 'starter', 'professional', 'enterprise']).defaultTo('free');
    table.jsonb('settings').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('slug');
  });

  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('email').notNullable();
    table.string('password_hash').notNullable();
    table.string('first_name').notNullable();
    table.string('last_name').notNullable();
    table.enum('role', ['owner', 'admin', 'member', 'viewer']).defaultTo('member');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_login_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['email', 'tenant_id']);
    table.index('tenant_id');
    table.index('email');
  });

  // Workflows table
  await knex.schema.createTable('workflows', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name').notNullable();
    table.text('description');
    table.jsonb('nodes').defaultTo('[]');
    table.jsonb('connections').defaultTo('[]');
    table.jsonb('settings').defaultTo('{}');
    table.enum('status', ['draft', 'active', 'inactive', 'error']).defaultTo('draft');
    table.specificType('tags', 'text[]').defaultTo('{}');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('updated_by').notNullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('version').defaultTo(1);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
    table.index('status');
    table.index('created_by');
    table.index(['tenant_id', 'status']);
  });

  // Executions table (partitioned-ready)
  await knex.schema.createTable('executions', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('workflow_id').notNullable().references('id').inTable('workflows').onDelete('CASCADE');
    table.enum('status', ['pending', 'running', 'success', 'error', 'cancelled', 'waiting', 'retry']).defaultTo('pending');
    table.enum('mode', ['manual', 'trigger', 'webhook', 'retry', 'sub_workflow']).defaultTo('manual');
    table.jsonb('data').defaultTo('{}');
    table.jsonb('error');
    table.uuid('retry_of');
    table.uuid('retry_success_id');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('triggered_by').references('id').inTable('users');
    table.string('worker_id');
    table.timestamp('started_at').defaultTo(knex.fn.now());
    table.timestamp('finished_at');

    table.index('workflow_id');
    table.index('tenant_id');
    table.index('status');
    table.index('started_at');
    table.index(['tenant_id', 'status']);
    table.index(['workflow_id', 'started_at']);
  });

  // Credentials table (encrypted storage)
  await knex.schema.createTable('credentials', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name').notNullable();
    table.string('type').notNullable();
    table.text('data_encrypted').notNullable();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('created_by').notNullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
    table.index('type');
  });

  // Webhook registrations
  await knex.schema.createTable('webhooks', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('workflow_id').notNullable().references('id').inTable('workflows').onDelete('CASCADE');
    table.string('node_id').notNullable();
    table.string('method').notNullable();
    table.string('path').notNullable().unique();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('path');
    table.index('workflow_id');
  });

  // Audit logs
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users');
    table.string('action').notNullable();
    table.string('resource_type').notNullable();
    table.uuid('resource_id');
    table.jsonb('details').defaultTo('{}');
    table.string('ip_address');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
    table.index(['tenant_id', 'created_at']);
    table.index(['resource_type', 'resource_id']);
  });

  // Tags table
  await knex.schema.createTable('tags', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name').notNullable();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['name', 'tenant_id']);
  });

  // Workflow versions (for history tracking)
  await knex.schema.createTable('workflow_versions', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('workflow_id').notNullable().references('id').inTable('workflows').onDelete('CASCADE');
    table.integer('version').notNullable();
    table.jsonb('nodes').defaultTo('[]');
    table.jsonb('connections').defaultTo('[]');
    table.jsonb('settings').defaultTo('{}');
    table.uuid('created_by').references('id').inTable('users');
    table.text('change_description');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['workflow_id', 'version']);
    table.index('workflow_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('workflow_versions');
  await knex.schema.dropTableIfExists('tags');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('webhooks');
  await knex.schema.dropTableIfExists('credentials');
  await knex.schema.dropTableIfExists('executions');
  await knex.schema.dropTableIfExists('workflows');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('tenants');
}
