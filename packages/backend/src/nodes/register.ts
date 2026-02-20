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
import { SubWorkflowNode } from './logic/SubWorkflowNode';

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
import { ErrorTriggerNode } from './utility/ErrorTriggerNode';
import { DebugNode } from './utility/DebugNode';
import { DateTimeNode } from './utility/DateTimeNode';
import { CryptoNode } from './utility/CryptoNode';

// AI
import { OpenAINode } from './ai/OpenAINode';
import { AnthropicNode } from './ai/AnthropicNode';
import { AIAgentNode } from './ai/AIAgentNode';
import { TextSplitterNode } from './ai/TextSplitterNode';
import { EmbeddingsNode } from './ai/EmbeddingsNode';
import { VectorStoreNode } from './ai/VectorStoreNode';
import { SummarizeNode } from './ai/SummarizeNode';
import { SentimentNode } from './ai/SentimentNode';

// Integrations
import { SlackNode } from './integrations/SlackNode';
import { GitHubNode } from './integrations/GitHubNode';
import { GmailNode } from './integrations/GmailNode';
import { DiscordNode } from './integrations/DiscordNode';
import { TelegramNode } from './integrations/TelegramNode';
import { GoogleSheetsNode } from './integrations/GoogleSheetsNode';
import { NotionNode } from './integrations/NotionNode';
import { JiraNode } from './integrations/JiraNode';
import { PostgresNode } from './integrations/PostgresNode';
import { MySQLNode } from './integrations/MySQLNode';
import { MongoDBNode } from './integrations/MongoDBNode';
import { RedisNode } from './integrations/RedisNode';
import { StripeNode } from './integrations/StripeNode';
import { TwilioNode } from './integrations/TwilioNode';
import { SendGridNode } from './integrations/SendGridNode';
import { AWSS3Node } from './integrations/AWSS3Node';
import { HubSpotNode } from './integrations/HubSpotNode';
import { WebhookResponseNode } from './integrations/WebhookResponseNode';

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
  registry.register(SubWorkflowNode);

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
  registry.register(ErrorTriggerNode);
  registry.register(DebugNode);
  registry.register(DateTimeNode);
  registry.register(CryptoNode);

  // Register AI nodes
  registry.register(OpenAINode);
  registry.register(AnthropicNode);
  registry.register(AIAgentNode);
  registry.register(TextSplitterNode);
  registry.register(EmbeddingsNode);
  registry.register(VectorStoreNode);
  registry.register(SummarizeNode);
  registry.register(SentimentNode);

  // Register integration nodes
  registry.register(SlackNode);
  registry.register(GitHubNode);
  registry.register(GmailNode);
  registry.register(DiscordNode);
  registry.register(TelegramNode);
  registry.register(GoogleSheetsNode);
  registry.register(NotionNode);
  registry.register(JiraNode);
  registry.register(PostgresNode);
  registry.register(MySQLNode);
  registry.register(MongoDBNode);
  registry.register(RedisNode);
  registry.register(StripeNode);
  registry.register(TwilioNode);
  registry.register(SendGridNode);
  registry.register(AWSS3Node);
  registry.register(HubSpotNode);
  registry.register(WebhookResponseNode);
}
