import * as NodeModule from "node:module";
import ts from "typescript-legacy";

// Node's Wasm TypeScript parser is unreliable under QEMU; this compiler runs in JavaScript.
NodeModule.registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (loaded.format !== "module-typescript") return loaded;
    const result = ts.transpileModule(Buffer.from(loaded.source).toString("utf8"), {
      fileName: url,
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        verbatimModuleSyntax: true,
      },
      reportDiagnostics: true,
    });
    for (const diagnostic of result.diagnostics ?? []) {
      if (diagnostic.category === ts.DiagnosticCategory.Error)
        throw new SyntaxError(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
    return { ...loaded, format: "module", source: result.outputText };
  },
});
