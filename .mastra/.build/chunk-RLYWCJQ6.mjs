import { A as AISpanType } from './chunk-PPAIPZ6C.mjs';
import { o as objectType, r as recordType, s as stringType, a as anyType, n as numberType, e as enumType } from './v3.mjs';

recordType(stringType(), anyType()).optional();
var scoringValueSchema = numberType();
objectType({
  result: recordType(stringType(), anyType()).optional(),
  score: scoringValueSchema,
  prompt: stringType().optional()
});
var saveScorePayloadSchema = objectType({
  runId: stringType(),
  scorerId: stringType(),
  entityId: stringType(),
  score: numberType(),
  input: anyType().optional(),
  output: anyType(),
  source: enumType(["LIVE", "TEST"]),
  entityType: enumType(["AGENT", "WORKFLOW", ...Object.values(AISpanType)]).optional(),
  scorer: recordType(stringType(), anyType()),
  traceId: stringType().optional(),
  spanId: stringType().optional(),
  preprocessStepResult: recordType(stringType(), anyType()).optional(),
  extractStepResult: recordType(stringType(), anyType()).optional(),
  analyzeStepResult: recordType(stringType(), anyType()).optional(),
  reason: stringType().optional(),
  metadata: recordType(stringType(), anyType()).optional(),
  preprocessPrompt: stringType().optional(),
  extractPrompt: stringType().optional(),
  generateScorePrompt: stringType().optional(),
  generateReasonPrompt: stringType().optional(),
  analyzePrompt: stringType().optional(),
  additionalContext: recordType(stringType(), anyType()).optional(),
  runtimeContext: recordType(stringType(), anyType()).optional(),
  entity: recordType(stringType(), anyType()).optional(),
  resourceId: stringType().optional(),
  threadId: stringType().optional()
});

export { saveScorePayloadSchema as s };
//# sourceMappingURL=chunk-RLYWCJQ6.mjs.map
