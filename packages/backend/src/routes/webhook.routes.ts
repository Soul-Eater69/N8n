import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../config/database';
import { ExecutionService } from '../services/execution.service';
import { addExecutionJob } from '../services/queue.service';
import { webhookLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

const router = Router();
const executionService = new ExecutionService();

// Handle all webhook requests
const handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhookPath = req.params[0] || req.path;
    const db = getDatabase();

    const webhook = await db('webhooks')
      .where({ path: webhookPath, is_active: true })
      .first();

    if (!webhook) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Webhook not found' },
      });
      return;
    }

    if (webhook.method !== 'ALL' && webhook.method !== req.method) {
      res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed for this webhook' },
      });
      return;
    }

    const execution = await executionService.create(
      webhook.workflow_id,
      webhook.tenant_id,
      'webhook'
    );

    await addExecutionJob({
      executionId: execution.id,
      workflowId: webhook.workflow_id,
      tenantId: webhook.tenant_id,
      mode: 'webhook',
      triggerData: {
        method: req.method,
        headers: req.headers as Record<string, string>,
        query: req.query as Record<string, string>,
        body: req.body,
        path: webhookPath,
      },
    });

    logger.info({ webhookPath, executionId: execution.id }, 'Webhook triggered');

    res.status(200).json({
      success: true,
      data: {
        executionId: execution.id,
        message: 'Workflow triggered',
      },
    });
  } catch (error) {
    next(error);
  }
};

router.all('/*', webhookLimiter, handleWebhook);

export default router;
