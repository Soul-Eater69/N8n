# FlowForge Node Reference

Complete reference for all 46 built-in nodes organized by category.

---

## Table of Contents

- [Triggers](#triggers)
- [Logic](#logic)
- [Actions](#actions)
- [Transform](#transform)
- [Utility](#utility)
- [AI / Machine Learning](#ai--machine-learning)
- [Integrations](#integrations)

---

## Triggers

Trigger nodes start a workflow execution. Every workflow must begin with at least one trigger node.

### Manual Trigger
**Type:** `trigger.manual` | **Icon:** play | **Color:** #6366F1

Starts a workflow manually from the UI or API. Used for testing and on-demand execution.

**Properties:** None

**Output:** `[{ json: { timestamp, executionId, mode: "manual" } }]`

---

### Webhook Trigger
**Type:** `trigger.webhook` | **Icon:** globe | **Color:** #F59E0B

Starts a workflow when an HTTP request is received at the webhook URL.

**Properties:**
| Property     | Type    | Default | Description                              |
|-------------|---------|---------|------------------------------------------|
| path        | string  | ""      | Webhook URL path (e.g., `/my-webhook`)   |
| httpMethod  | options | POST    | GET, POST, PUT, PATCH, DELETE            |
| responseMode| options | onReceived | When to respond: immediately or after last node |
| authentication | options | none | none, basicAuth, headerAuth              |

**Output:** `[{ json: { method, headers, query, body, path } }]`

---

### Cron Trigger
**Type:** `trigger.cron` | **Icon:** clock | **Color:** #10B981

Starts a workflow on a schedule using cron expressions.

**Properties:**
| Property       | Type    | Default     | Description                         |
|---------------|---------|-------------|-------------------------------------|
| cronExpression| string  | `0 * * * *` | Standard cron expression            |
| timezone      | string  | UTC         | IANA timezone for scheduling        |

**Common Cron Patterns:**
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 9 * * *` - Daily at 9 AM
- `0 9 * * 1` - Every Monday at 9 AM
- `0 0 1 * *` - First day of every month

**Output:** `[{ json: { timestamp, cronExpression, timezone, executionCount } }]`

---

## Logic

Logic nodes control the flow of data through the workflow.

### If
**Type:** `logic.if` | **Icon:** git-branch | **Color:** #8B5CF6

Routes data to different outputs based on a condition.

**Properties:**
| Property  | Type    | Default  | Description                              |
|----------|---------|----------|------------------------------------------|
| field    | string  | ""       | Field to evaluate (dot notation)         |
| operator | options | equals   | equals, notEquals, contains, gt, lt, gte, lte, isEmpty, isNotEmpty, regex, exists |
| value    | string  | ""       | Value to compare against                 |

**Outputs:** 2 outputs - `true` (condition met) and `false` (condition not met)

---

### Switch
**Type:** `logic.switch` | **Icon:** shuffle | **Color:** #EC4899

Routes data to multiple outputs based on matching rules.

**Properties:**
| Property     | Type    | Default | Description                          |
|-------------|---------|---------|--------------------------------------|
| field       | string  | ""      | Field to evaluate                    |
| rules       | json    | []      | Array of `{ value, output }` rules   |
| fallbackOutput | number | -1   | Output index for unmatched items     |

**Outputs:** Dynamic (one per rule + fallback)

---

### Merge
**Type:** `logic.merge` | **Icon:** git-merge | **Color:** #06B6D4

Combines data from multiple input branches.

**Properties:**
| Property | Type    | Default | Description                                  |
|---------|---------|---------|----------------------------------------------|
| mode    | options | append  | append, merge, keepOnlyMatching, keepEverything, multiplex |
| joinField | string | id    | Field to join on (for merge mode)            |

---

### Loop
**Type:** `logic.loop` | **Icon:** repeat | **Color:** #F97316

Iterates over input items or a fixed count.

**Properties:**
| Property   | Type    | Default | Description                            |
|-----------|---------|---------|----------------------------------------|
| mode      | options | each    | each (iterate items), count (fixed iterations), while (condition) |
| count     | number  | 10      | Number of iterations (count mode)      |
| batchSize | number  | 1       | Items per batch                        |
| condition | string  | ""      | While condition expression             |

---

### Execute Sub-Workflow
**Type:** `logic.subWorkflow` | **Icon:** layers | **Color:** #6C5CE7

Executes another workflow as a sub-workflow and returns its output.

**Properties:**
| Property          | Type    | Default  | Description                              |
|------------------|---------|----------|------------------------------------------|
| workflowId       | string  | ""       | ID of the workflow to execute            |
| executionMode    | options | inline   | inline (same process) or queued (worker) |
| waitForCompletion| boolean | true     | Wait for queued execution to finish      |
| timeout          | number  | 300000   | Timeout in milliseconds                  |
| inputMapping     | json    | {}       | Map parent fields to sub-workflow inputs |

**Max nesting depth:** 5 levels

---

## Actions

### HTTP Request
**Type:** `action.httpRequest` | **Icon:** globe | **Color:** #3B82F6

Makes HTTP requests to external APIs.

**Properties:**
| Property      | Type    | Default | Description                         |
|--------------|---------|---------|-------------------------------------|
| method       | options | GET     | GET, POST, PUT, PATCH, DELETE, HEAD |
| url          | string  | ""      | Full URL to request                 |
| headers      | json    | {}      | Request headers                     |
| queryParams  | json    | {}      | URL query parameters                |
| body         | json    | {}      | Request body (POST/PUT/PATCH)       |
| contentType  | options | json    | json, form, multipart, raw          |
| authentication | options | none | none, basicAuth, bearerToken, custom |
| timeout      | number  | 30000   | Request timeout in ms               |
| followRedirects | boolean | true | Follow HTTP redirects               |
| responseType | options | json    | json, text, binary, full            |

---

### Respond
**Type:** `action.respond` | **Icon:** arrow-right | **Color:** #22C55E

Returns data to the workflow caller (API trigger).

---

## Transform

### Set
**Type:** `transform.set` | **Icon:** edit-3 | **Color:** #14B8A6

Sets or modifies field values on items.

**Properties:**
| Property    | Type    | Default   | Description                       |
|------------|---------|-----------|-----------------------------------|
| mode       | options | manual    | manual, expression, json          |
| assignments | json   | []        | Array of `{ field, value }` pairs |
| keepOriginal | boolean | true    | Keep fields not in assignments    |

---

### Function
**Type:** `transform.function` | **Icon:** code | **Color:** #6366F1

Execute custom JavaScript code on each item.

**Properties:**
| Property    | Type   | Default  | Description                    |
|------------|--------|----------|--------------------------------|
| functionCode | string | ""    | JavaScript code to execute     |
| mode       | options | each    | each (per item) or all (all items) |

**Available in code context:**
- `$input.item` - Current input item
- `$input.all()` - All input items
- `$node["NodeName"]` - Access other node outputs
- `$json` - Shorthand for current item JSON

---

### Filter
**Type:** `transform.filter` | **Icon:** filter | **Color:** #F59E0B

Filters items based on conditions.

**Properties:**
| Property   | Type    | Default | Description                        |
|-----------|---------|---------|-------------------------------------|
| field     | string  | ""      | Field to evaluate                   |
| operator  | options | equals  | Same operators as If node           |
| value     | string  | ""      | Value to compare                    |
| combineMode | options | and  | and, or (for multiple conditions)   |

---

### Aggregate
**Type:** `transform.aggregate` | **Icon:** bar-chart-2 | **Color:** #8B5CF6

Aggregates multiple items into summary values.

**Properties:**
| Property   | Type    | Default | Description                         |
|-----------|---------|---------|--------------------------------------|
| operation | options | count   | count, sum, average, min, max, concat, unique, groupBy |
| field     | string  | ""      | Field to aggregate on               |
| groupBy   | string  | ""      | Field to group results by           |

---

## Utility

### Delay
**Type:** `utility.delay` | **Icon:** clock | **Color:** #F59E0B

Pauses execution for a specified duration.

**Properties:**
| Property | Type    | Default | Description                      |
|---------|---------|---------|----------------------------------|
| duration | number | 1000    | Delay in milliseconds            |
| unit    | options | ms      | ms, seconds, minutes, hours      |

---

### Error Handler
**Type:** `utility.errorHandler` | **Icon:** shield | **Color:** #EF4444

Catches and handles errors from upstream nodes.

**Properties:**
| Property      | Type    | Default | Description                      |
|--------------|---------|---------|----------------------------------|
| mode         | options | catch   | catch, retry, fallback           |
| maxRetries   | number  | 3       | Max retry attempts               |
| retryDelay   | number  | 1000    | Delay between retries (ms)       |
| fallbackData | json    | {}      | Default data if all retries fail |

---

### Error Trigger
**Type:** `utility.errorTrigger` | **Icon:** alert-triangle | **Color:** #DC2626

Triggers when a workflow configured as an error handler receives an error.

**Output:** `[{ json: { error: { message, stack, timestamp }, execution: { id, mode }, workflow: { id, name }, node: { id, name, type } } }]`

---

### Debug
**Type:** `utility.debug` | **Icon:** terminal | **Color:** #6B7280

Logs data to the execution output for debugging.

**Properties:**
| Property | Type    | Default | Description                     |
|---------|---------|---------|----------------------------------|
| mode    | options | all     | all (log everything), selected (specific fields), expression |
| fields  | string  | ""      | Comma-separated field names      |

---

### DateTime
**Type:** `utility.dateTime` | **Icon:** calendar | **Color:** #3B82F6

Format, parse, and manipulate date and time values.

**Properties:**
| Property  | Type    | Default    | Description                      |
|----------|---------|------------|----------------------------------|
| operation | options | format    | format, parse, add, subtract, diff, now |
| date     | string  | ""         | Input date value                 |
| format   | string  | ISO 8601   | Output format string             |
| amount   | number  | 0          | Amount to add/subtract           |
| unit     | options | days       | years, months, days, hours, minutes, seconds |
| timezone | string  | UTC        | Target timezone                  |

---

### Crypto
**Type:** `utility.crypto` | **Icon:** lock | **Color:** #7C3AED

Hashing, encoding, and cryptographic operations.

**Properties:**
| Property   | Type    | Default | Description                        |
|-----------|---------|---------|-------------------------------------|
| operation | options | hash    | hash, hmac, encode, decode, uuid, random |
| algorithm | options | sha256  | md5, sha1, sha256, sha512          |
| encoding  | options | hex     | hex, base64, utf8                  |
| input     | string  | ""      | Input data to process              |
| key       | string  | ""      | Secret key (for HMAC)              |

---

## AI / Machine Learning

### OpenAI
**Type:** `ai.openai` | **Icon:** brain | **Color:** #10A37F

Interact with OpenAI models for chat, completions, embeddings, image generation, and audio transcription.

**Properties:**
| Property         | Type    | Default      | Description                    |
|-----------------|---------|-------------|--------------------------------|
| operation       | options | chat        | chat, complete, embed, image-generate, audio-transcribe |
| model           | options | gpt-4o      | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |
| systemPrompt    | string  | ""          | System message                 |
| userPrompt      | string  | ""          | User message                   |
| temperature     | number  | 0.7         | Randomness (0-2)               |
| maxTokens       | number  | 1024        | Max output tokens              |
| topP            | number  | 1           | Nucleus sampling               |
| frequencyPenalty | number | 0           | Frequency penalty (-2 to 2)    |
| presencePenalty | number  | 0           | Presence penalty (-2 to 2)     |
| responseFormat  | options | text        | text, json_object              |
| imageSize       | options | 1024x1024   | DALL-E image dimensions        |

**Credentials:** `openai` - requires `apiKey`

---

### Anthropic
**Type:** `ai.anthropic` | **Icon:** brain | **Color:** #D4A574

Interact with Anthropic Claude models.

**Properties:**
| Property         | Type    | Default           | Description                |
|-----------------|---------|-------------------|----------------------------|
| operation       | options | chat              | chat, complete             |
| model           | options | claude-sonnet-4-5-20250929 | Claude model selection    |
| systemPrompt    | string  | ""                | System instructions        |
| userPrompt      | string  | ""                | User message               |
| temperature     | number  | 0.7               | Randomness (0-1)           |
| maxTokens       | number  | 1024              | Max output tokens          |

**Credentials:** `anthropic` - requires `apiKey`

---

### AI Agent
**Type:** `ai.agent` | **Icon:** bot | **Color:** #8B5CF6

LangChain-style AI agent with tool use, memory, and reasoning.

**Properties:**
| Property      | Type    | Default      | Description                       |
|--------------|---------|-------------|-----------------------------------|
| agentType    | options | conversational | conversational, react, plan-and-execute |
| model        | options | gpt-4o      | AI model to use                   |
| systemPrompt | string  | ""          | Agent instructions                |
| tools        | json    | []          | Tool definitions for the agent    |
| maxIterations | number | 10          | Max reasoning steps               |
| memoryType   | options | buffer      | buffer, window, summary           |
| memoryWindow | number  | 10          | Messages to keep in window memory |

**Credentials:** `openai` or `anthropic`

---

### Text Splitter
**Type:** `ai.textSplitter` | **Icon:** scissors | **Color:** #06B6D4

Splits text into chunks for embedding and vector storage.

**Properties:**
| Property     | Type    | Default          | Description                    |
|-------------|---------|-----------------|--------------------------------|
| strategy    | options | recursive        | recursive, character, token, markdown, code |
| chunkSize   | number  | 1000             | Characters per chunk           |
| chunkOverlap | number | 200              | Overlap between chunks         |
| separator   | string  | "\n\n"           | Split separator                |

---

### Embeddings
**Type:** `ai.embeddings` | **Icon:** hash | **Color:** #10A37F

Generate vector embeddings from text.

**Properties:**
| Property | Type    | Default                  | Description           |
|---------|---------|--------------------------|------------------------|
| model   | options | text-embedding-3-small   | Embedding model       |
| input   | string  | ""                       | Text to embed         |

---

### Vector Store
**Type:** `ai.vectorStore` | **Icon:** database | **Color:** #7C3AED

Store and query vector embeddings for similarity search.

**Properties:**
| Property     | Type    | Default | Description                     |
|-------------|---------|---------|----------------------------------|
| operation   | options | query   | store, query, delete            |
| collection  | string  | ""      | Collection/index name           |
| topK        | number  | 5       | Number of similar results       |
| minScore    | number  | 0.7     | Minimum similarity score        |

---

### Summarize
**Type:** `ai.summarize` | **Icon:** file-text | **Color:** #F59E0B

Summarize text using AI models.

**Properties:**
| Property     | Type    | Default  | Description                    |
|-------------|---------|----------|--------------------------------|
| mode        | options | concise  | concise, detailed, bullets, custom |
| maxLength   | number  | 200      | Target summary length          |
| customPrompt | string | ""       | Custom summarization prompt    |

---

### Sentiment
**Type:** `ai.sentiment` | **Icon:** heart | **Color:** #EF4444

Analyze text sentiment (positive, negative, neutral).

**Properties:**
| Property | Type    | Default  | Description                    |
|---------|---------|----------|--------------------------------|
| field   | string  | text     | Field containing text to analyze |
| detailed | boolean | false   | Return detailed analysis       |

---

## Integrations

### Slack
**Type:** `integration.slack` | **Icon:** message-circle | **Color:** #4A154B

**Operations:** sendMessage, updateMessage, deleteMessage, getChannel, listChannels, uploadFile, addReaction, getUserInfo, setTopic

**Credentials:** `slack` - requires `botToken`

---

### GitHub
**Type:** `integration.github` | **Icon:** github | **Color:** #181717

**Operations:** createIssue, getIssue, listIssues, createPR, mergePR, listRepos, getRepo, createComment, listCommits, createRelease

**Credentials:** `github` - requires `accessToken`

---

### Gmail
**Type:** `integration.gmail` | **Icon:** mail | **Color:** #EA4335

**Operations:** sendEmail, getEmail, listEmails, replyToEmail, addLabel, removeLabel, markAsRead, trashEmail

**Credentials:** `gmail` - requires `accessToken` (OAuth2)

---

### Discord
**Type:** `integration.discord` | **Icon:** message-square | **Color:** #5865F2

**Operations:** sendMessage, editMessage, deleteMessage, createChannel, getChannel, addReaction, getGuildMembers

**Credentials:** `discord` - requires `botToken`

---

### Telegram
**Type:** `integration.telegram` | **Icon:** send | **Color:** #26A5E4

**Operations:** sendMessage, sendPhoto, sendDocument, editMessage, deleteMessage, getChat, getChatMembers, sendLocation, answerCallbackQuery

**Credentials:** `telegram` - requires `botToken`

---

### Google Sheets
**Type:** `integration.googleSheets` | **Icon:** table | **Color:** #34A853

**Operations:** readRange, appendRow, updateRange, clearRange, getSpreadsheet, createSpreadsheet, addSheet, deleteSheet

**Credentials:** `googleSheets` - requires `accessToken` (OAuth2)

---

### Notion
**Type:** `integration.notion` | **Icon:** book-open | **Color:** #000000

**Operations:** createPage, getPage, updatePage, queryDatabase, createDatabase, archivePage, search, appendBlock

**Credentials:** `notion` - requires `apiKey`

---

### Jira
**Type:** `integration.jira` | **Icon:** check-square | **Color:** #0052CC

**Operations:** createIssue, getIssue, updateIssue, listIssues, addComment, transitionIssue, assignIssue, listProjects

**Credentials:** `jira` - requires `email`, `apiToken`, `domain`

---

### PostgreSQL
**Type:** `integration.postgres` | **Icon:** database | **Color:** #336791

**Operations:** executeQuery, insert, update, delete, select

Builds parameterized queries to prevent SQL injection.

**Credentials:** `postgres` - requires `host`, `port`, `database`, `user`, `password`

---

### MySQL
**Type:** `integration.mysql` | **Icon:** database | **Color:** #4479A1

**Operations:** executeQuery, insert, update, delete, select

**Credentials:** `mysql` - requires `host`, `port`, `database`, `user`, `password`

---

### MongoDB
**Type:** `integration.mongodb` | **Icon:** database | **Color:** #47A248

**Operations:** find, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany, aggregate, countDocuments

**Credentials:** `mongodb` - requires `connectionString`

---

### Redis
**Type:** `integration.redis` | **Icon:** zap | **Color:** #DC382D

**Operations:** get, set, delete, incr, decr, hGet, hSet, hGetAll, lPush, lRange, lLen, sAdd, sMembers, publish, keys, expire, ttl, exists

**Credentials:** `redis` - requires `url` or `host`/`port`/`password`

---

### Stripe
**Type:** `integration.stripe` | **Icon:** credit-card | **Color:** #635BFF

**Operations:** createCharge, createCustomer, getCustomer, listCustomers, createPaymentIntent, confirmPaymentIntent, createSubscription, cancelSubscription, listPayments, createRefund, createProduct, createPrice

**Credentials:** `stripe` - requires `secretKey`

---

### Twilio
**Type:** `integration.twilio` | **Icon:** phone | **Color:** #F22F46

**Operations:** sendSMS, sendWhatsApp, makeCall, getCall, listMessages

**Credentials:** `twilio` - requires `accountSid`, `authToken`

---

### SendGrid
**Type:** `integration.sendgrid` | **Icon:** mail | **Color:** #1A82E2

**Operations:** sendEmail, sendTemplateEmail, addContact, listContacts, createList

**Credentials:** `sendgrid` - requires `apiKey`

---

### AWS S3
**Type:** `integration.awsS3` | **Icon:** cloud | **Color:** #FF9900

**Operations:** listBuckets, listObjects, getObject, putObject, deleteObject, copyObject, getSignedUrl

Implements full AWS Signature V4 for request signing.

**Credentials:** `awsS3` - requires `accessKeyId`, `secretAccessKey`, `region`

---

### HubSpot
**Type:** `integration.hubspot` | **Icon:** users | **Color:** #FF7A59

**Operations:** createContact, getContact, updateContact, listContacts, searchContacts, createDeal, getDeal, updateDeal, listDeals, createCompany, getCompany

**Credentials:** `hubspot` - requires `accessToken`

---

### Webhook Response
**Type:** `integration.webhookResponse` | **Icon:** arrow-left | **Color:** #00B894

Sends a custom HTTP response back to a webhook caller.

**Properties:**
| Property        | Type    | Default          | Description                    |
|----------------|---------|-----------------|--------------------------------|
| statusCode     | options | 200             | HTTP status code               |
| contentType    | options | application/json | Response content type          |
| responseBody   | json    | {}              | Response body                  |
| responseHeaders | json   | {}              | Custom headers                 |
| redirectUrl    | string  | ""              | Redirect URL (301/302 only)    |

**No credentials required.**
