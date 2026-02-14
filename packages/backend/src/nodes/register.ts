import { NodeRegistry } from '../engine/NodeRegistry';

// Triggers
import { ManualTriggerNode } from './triggers/ManualTrigger';
import { WebhookTriggerNode } from './triggers/WebhookTrigger';
import { CronTriggerNode } from './triggers/CronTrigger';

// Logic
import { IfNode } from './logic/IfNode';
import { SwitchNode } from './logic/SwitchNode';
import { MergeNode } from './logic/MergeNode';
import { LoopNode } from './logic/LoopNode';

// Actions
import { HttpRequestNode } from './actions/HttpRequestNode';
import { RespondNode } from './actions/RespondNode';

// Transform
import { SetNode } from './transform/SetNode';
import { FunctionNode } from './transform/FunctionNode';
import { FilterNode } from './transform/FilterNode';
import { AggregateNode } from './transform/AggregateNode';

// Utility
import { DelayNode } from './utility/DelayNode';
import { ErrorHandlerNode } from './utility/ErrorHandlerNode';

export function registerAllNodes(): void {
  const registry = NodeRegistry.getInstance();

  // Register triggers
  registry.register(ManualTriggerNode);
  registry.register(WebhookTriggerNode);
  registry.register(CronTriggerNode);

  // Register logic nodes
  registry.register(IfNode);
  registry.register(SwitchNode);
  registry.register(MergeNode);
  registry.register(LoopNode);

  // Register action nodes
  registry.register(HttpRequestNode);
  registry.register(RespondNode);

  // Register transform nodes
  registry.register(SetNode);
  registry.register(FunctionNode);
  registry.register(FilterNode);
  registry.register(AggregateNode);

  // Register utility nodes
  registry.register(DelayNode);
  registry.register(ErrorHandlerNode);
}
