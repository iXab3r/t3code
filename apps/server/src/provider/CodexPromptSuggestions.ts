import * as CodexClient from "effect-codex-app-server/client";
import * as CodexSchema from "effect-codex-app-server/schema";
import * as Cache from "effect/Cache";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Random from "effect/Random";
import { HttpClient, HttpClientRequest } from "effect/http";

const PredictionConfig = Schema.Struct({
  is_enabled: Schema.Boolean,
  prompt: Schema.String,
  prediction_reasoning_effort: Schema.String,
  unsupported_models: Schema.optional(Schema.Array(Schema.String)),
  live_sample_rate: Schema.optional(Schema.Number),
});
const Source = Schema.Struct({
  model: Schema.String,
  modelProvider: Schema.String,
  collaborationMode: Schema.optional(Schema.NullOr(Schema.Struct({ mode: Schema.String }))),
});
const Sample = Schema.Struct({
  sourceTurnId: Schema.String,
  text: Schema.optional(Schema.NullOr(Schema.String)),
});
const Suggestion = Schema.Struct({ suggestion: Schema.NullOr(Schema.String) });
const decodePredictionConfig = Schema.decodeUnknownEffect(PredictionConfig);
const decodeSource = Schema.decodeUnknownEffect(Source);
const decodeSample = Schema.decodeUnknownEffect(Sample);
const decodeSuggestion = Schema.decodeEffect(Schema.fromJsonString(Suggestion));
const decodeAuth = Schema.decodeUnknownEffect(CodexSchema.GetAuthStatusResponse);

export const make = Effect.fn("CodexPromptSuggestions.make")(function* () {
  const client = yield* CodexClient.CodexAppServerClient;
  const http = yield* HttpClient.HttpClient;
  const configurations = yield* Cache.make({
    capacity: 1,
    timeToLive: "5 minutes",
    lookup: Effect.fn("CodexPromptSuggestions.config")(function* (token: string) {
      const response = yield* http.execute(
        HttpClientRequest.get("https://chatgpt.com/backend-api/wham/predictions/config").pipe(
          HttpClientRequest.bearerToken(token),
        ),
      );
      if (response.status !== 200) return null;
      return yield* response.json.pipe(Effect.flatMap(decodePredictionConfig));
    }),
  });

  return Effect.fn("CodexPromptSuggestions.generate")(
    function* (threadId: string, turnId: string) {
      const auth = yield* client.raw
        .request("getAuthStatus", {
          includeToken: true,
          refreshToken: false,
        })
        .pipe(Effect.flatMap(decodeAuth));
      if (
        (auth.authMethod !== "chatgpt" && auth.authMethod !== "chatgptAuthTokens") ||
        auth.authToken === null
      )
        return null;
      const config = yield* Cache.get(configurations, auth.authToken);
      if (config === null || !config.is_enabled || (config.live_sample_rate ?? 1) === 0)
        return null;
      if ((config.live_sample_rate ?? 1) < 1 && (yield* Random.next) >= config.live_sample_rate!)
        return null;
      const source = yield* client.raw
        .request("thread/resume", { threadId, excludeTurns: true })
        .pipe(Effect.flatMap(decodeSource));
      if (
        source.modelProvider !== "openai" ||
        source.collaborationMode?.mode === "plan" ||
        config.unsupported_models?.includes(source.model)
      )
        return null;
      const prompt = `${config.prompt}\n\nReturn only JSON matching this schema: {"type":"object","properties":{"suggestion":{"type":["string","null"]}},"required":["suggestion"],"additionalProperties":false}.`;
      const sample = yield* client.raw
        .request("thread/sample", {
          threadId,
          expectedTurnId: turnId,
          prompt,
          effort: config.prediction_reasoning_effort || null,
          turnTrigger: "composer_predictions",
          responsesapiClientMetadata: {
            prediction_source_thread_id: threadId,
            prediction_source_turn_id: turnId,
            prediction_trigger: "live",
          },
        })
        .pipe(Effect.flatMap(decodeSample));
      if (sample.sourceTurnId !== turnId || sample.text == null) return null;
      const result = yield* decodeSuggestion(sample.text);
      return result.suggestion?.trim() || null;
    },
    Effect.timeout("30 seconds"),
    Effect.orElseSucceed(() => null),
  );
});
