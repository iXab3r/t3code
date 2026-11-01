import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { HttpClient, HttpClientResponse } from "effect/http";
import { CodexAppServerRequestError } from "effect-codex-app-server/errors";
import { make } from "./CodexPromptSuggestions.ts";
import * as CodexClient from "effect-codex-app-server/client";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";

const makeClient = Effect.fn("TestCodexPromptSuggestions.makeClient")(function* (
  request: CodexClient.CodexAppServerClient["Service"]["raw"]["request"],
) {
  const client = yield* CodexClient.make(
    Stdio.make({
      args: Effect.succeed([]),
      stdin: Stream.never,
      stdout: () => Sink.drain,
      stderr: () => Sink.drain,
    }),
  );
  return { ...client, raw: { ...client.raw, request } };
});

const SampleRequest = Schema.Struct({
  threadId: Schema.String,
  expectedTurnId: Schema.String,
  prompt: Schema.String,
  effort: Schema.String,
  turnTrigger: Schema.String,
});
const decodeSampleRequest = Schema.decodeUnknownEffect(SampleRequest);

it.effect(
  "inherits the native session and refreshes the original prompt per account and expiry",
  () =>
    Effect.gen(function* () {
      let token = "account-a";
      const fetched: string[] = [];
      const http = HttpClient.make((request) =>
        Effect.sync(() => {
          const account = request.headers.authorization!;
          fetched.push(account);
          return HttpClientResponse.fromWeb(
            request,
            Response.json({
              is_enabled: true,
              prompt: `Original prompt for ${account}`,
              prediction_reasoning_effort: "high",
              unsupported_models: [],
            }),
          );
        }),
      );
      const client = yield* makeClient((method, params) =>
        Effect.gen(function* () {
          if (method === "getAuthStatus")
            return { authMethod: "chatgpt", authToken: token, requiresOpenaiAuth: true };
          if (method === "thread/resume") return { model: "native-model", modelProvider: "openai" };
          assert.equal(method, "thread/sample");
          const input = yield* decodeSampleRequest(params).pipe(Effect.orDie);
          assert.equal(input.effort, "high");
          assert.equal(input.turnTrigger, "composer_predictions");
          assert.include(input.prompt, `Original prompt for Bearer ${token}`);
          assert.include(input.prompt, "Return only JSON");
          return {
            sourceTurnId: input.expectedTurnId,
            text: '{"suggestion":"  Run the checks  "}',
          };
        }),
      );
      const generate = yield* make().pipe(
        Effect.provideService(CodexClient.CodexAppServerClient, client),
        Effect.provideService(HttpClient.HttpClient, http),
      );
      assert.equal(yield* generate("parent", "turn-1"), "Run the checks");
      assert.equal(yield* generate("parent", "turn-2"), "Run the checks");
      assert.equal(fetched.length, 1);
      token = "account-b";
      assert.equal(yield* generate("parent", "turn-3"), "Run the checks");
      assert.deepEqual(fetched, ["Bearer account-a", "Bearer account-b"]);
      yield* TestClock.adjust("5 minutes");
      assert.equal(yield* generate("parent", "turn-4"), "Run the checks");
      assert.equal(fetched.length, 3);
    }).pipe(Effect.scoped),
);

it.effect("withholds unsupported, disabled, failed and stale predictions without a fallback", () =>
  Effect.gen(function* () {
    for (const scenario of [
      "signed-out",
      "disabled",
      "sample-rate",
      "http-error",
      "plan",
      "model",
      "provider",
      "tool",
      "stale",
      "invalid",
      "error",
      "unsupported-rpc",
    ] as const) {
      let samples = 0;
      const http = HttpClient.make((request) =>
        Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            Response.json(
              {
                is_enabled: scenario !== "disabled",
                live_sample_rate: scenario === "sample-rate" ? 0 : 1,
                prompt: "Native prompt",
                prediction_reasoning_effort: "high",
                unsupported_models: scenario === "model" ? ["native-model"] : [],
              },
              { status: scenario === "http-error" ? 503 : 200 },
            ),
          ),
        ),
      );
      const client = yield* makeClient((method) => {
        if (method === "getAuthStatus")
          return Effect.succeed({
            authMethod: "chatgpt",
            authToken: scenario === "signed-out" ? null : "account",
            requiresOpenaiAuth: true,
          });
        if (method === "thread/resume")
          return Effect.succeed({
            model: "native-model",
            modelProvider: scenario === "provider" ? "custom" : "openai",
            collaborationMode: { mode: scenario === "plan" ? "plan" : "default" },
          });
        samples += 1;
        if (scenario === "unsupported-rpc")
          return Effect.fail(CodexAppServerRequestError.methodNotFound(method));
        return scenario === "error"
          ? Effect.succeed({})
          : Effect.succeed({
              sourceTurnId: scenario === "stale" ? "old-turn" : "turn",
              text:
                scenario === "tool"
                  ? null
                  : scenario === "invalid"
                    ? "not JSON"
                    : '{"suggestion":null}',
            });
      });
      const generate = yield* make().pipe(
        Effect.provideService(CodexClient.CodexAppServerClient, client),
        Effect.provideService(HttpClient.HttpClient, http),
      );
      assert.isNull(yield* generate("parent", "turn"), scenario);
      assert.equal(
        samples,
        ["tool", "stale", "invalid", "error", "unsupported-rpc"].includes(scenario) ? 1 : 0,
        scenario,
      );
    }
  }).pipe(Effect.scoped),
);
