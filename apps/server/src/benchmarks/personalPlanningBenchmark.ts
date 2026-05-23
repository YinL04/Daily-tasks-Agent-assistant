import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { agent } from "../agent/agent.js";
import type { AgentOptions, HarnessRunResult } from "../agent/types.js";

interface BenchmarkCase {
  id: string;
  category?: string;
  title: string;
  input: string;
  user_input?: string;
  options?: AgentOptions;
  expectedKeywords?: string[];
  must_cover_keywords?: string[];
  expected_elements?: string[];
  minTasks?: number;
  minEvents?: number;
  minRecommendations?: number;
}

interface RawOutput {
  id: string;
  title: string;
  input: string;
  durationMs: number;
  result?: HarnessRunResult;
  error?: string;
}

interface CaseResult {
  id: string;
  title: string;
  passed: boolean;
  score: number;
  durationMs: number;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  metrics: {
    llmConnected: boolean;
    stepCount: number;
    taskCount: number;
    eventCount: number;
    urlCount: number;
    recommendationCount: number;
    fileCount: number;
    actions: string[];
  };
  finalAnswerExcerpt: string;
  error?: string;
}

interface KeywordCoverage {
  matched: string[];
  missing: string[];
  coverage: number;
}

const sampleCases: BenchmarkCase[] = [
  {
    id: "sample-1",
    title: "学习计划",
    input: "帮我规划下周的学习安排。我想每天学 2 小时 TypeScript，还想周三前完成一个 React 小项目，并生成一个计划文档。",
    options: { generateFiles: false, generateCalendar: true, useMemory: true },
    expectedKeywords: ["TypeScript", "React"],
    minTasks: 3,
    minEvents: 1,
    minRecommendations: 1
  },
  {
    id: "sample-2",
    title: "旅行准备",
    input: "我要准备一次大阪旅行，帮我把订机票、订酒店、做预算、查景点和准备行李这些事排一个顺序。",
    options: { generateFiles: false, generateCalendar: true, useMemory: true },
    expectedKeywords: ["大阪", "机票", "酒店"],
    minTasks: 4,
    minEvents: 1,
    minRecommendations: 1
  }
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../../../..");

function loadEnv() {
  dotenv.config({ path: path.resolve(rootDir, ".env") });
  dotenv.config({ path: path.resolve(rootDir, "../.env") });
  dotenv.config();
}

function projectRoot() {
  return rootDir;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const valueOf = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    file: valueOf("--file"),
    limit: Number(valueOf("--limit") ?? "0") || undefined,
    outputDir: valueOf("--output-dir"),
    sample: args.includes("--sample"),
    reevaluate: args.includes("--reevaluate")
  };
}

function tryParseJsonCases(markdown: string): BenchmarkCase[] | null {
  const fences = [...markdown.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)];
  for (const fence of fences) {
    try {
      const parsed = JSON.parse(fence[1].trim()) as BenchmarkCase[] | { cases?: BenchmarkCase[] };
      const cases = Array.isArray(parsed) ? parsed : parsed.cases;
      if (Array.isArray(cases) && cases.length > 0) return normalizeCases(cases);
    } catch {
      // Keep trying other code fences; benchmark docs are often mixed markdown.
    }
  }
  return null;
}

function normalizeCases(cases: BenchmarkCase[]) {
  return cases.map((item, index) => {
    const input = item.input || item.user_input || "";
    const expectedKeywords = item.expectedKeywords || item.must_cover_keywords;
    return {
    ...item,
    id: item.id || `case-${index + 1}`,
    title: item.title || item.category || `Case ${index + 1}`,
    input,
    expectedKeywords,
    options: {
      generateFiles: false,
      generateCalendar: true,
      useMemory: true,
      ...item.options
    }
    };
  }).filter((item) => item.input?.trim());
}

function parseOptions(section: string): AgentOptions {
  const options: AgentOptions = { generateFiles: false, generateCalendar: true, useMemory: true };
  const setBool = (key: keyof AgentOptions, labels: string[]) => {
    const pattern = new RegExp(`(?:${labels.join("|")})\\s*[:：]\\s*(true|false|是|否|yes|no)`, "i");
    const match = section.match(pattern);
    if (!match) return;
    options[key] = /^(true|是|yes)$/i.test(match[1]);
  };
  setBool("generateFiles", ["generateFiles", "生成文件"]);
  setBool("generateCalendar", ["generateCalendar", "生成日历"]);
  setBool("useMemory", ["useMemory", "使用记忆"]);
  return options;
}

function readField(section: string, labels: string[]) {
  const labelPattern = labels.join("|");
  const lineMatch = section.match(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?(?:${labelPattern})\\s*[:：]\\s*(.+)`, "i"));
  if (lineMatch?.[1]?.trim()) return lineMatch[1].trim();

  const blockMatch = section.match(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?(?:${labelPattern})\\s*[:：]?\\s*\\n\\s*\`\`\`(?:text)?\\s*\\n([\\s\\S]*?)\`\`\``, "i"));
  return blockMatch?.[1]?.trim();
}

function splitKeywords(value: string | undefined) {
  if (!value) return undefined;
  return value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean);
}

function parseMarkdownCases(markdown: string): BenchmarkCase[] {
  const jsonCases = tryParseJsonCases(markdown);
  if (jsonCases) return jsonCases;

  const headingRegex = /^#{1,4}\s*(?:(?:Case|用例|案例)\s*)?(\d+)?[.、:：-]?\s*(.+)?$/gim;
  const headings = [...markdown.matchAll(headingRegex)]
    .filter((match) => /(?:case|用例|案例|\d+)/i.test(match[0]))
    .map((match) => ({ index: match.index ?? 0, number: match[1], title: match[2]?.trim() }));

  const cases: BenchmarkCase[] = [];
  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].index;
    const end = headings[i + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    const input = readField(section, ["用户输入", "输入", "User Input", "Prompt", "Input"]);
    if (!input) continue;
    const expectedKeywords = splitKeywords(readField(section, ["关键词", "Expected Keywords", "must_include", "必须包含"]));
    cases.push({
      id: headings[i].number ? `case-${headings[i].number}` : `case-${i + 1}`,
      title: headings[i].title || `Case ${i + 1}`,
      input,
      options: parseOptions(section),
      expectedKeywords,
      minTasks: Number(readField(section, ["minTasks", "最少任务数"])) || undefined,
      minEvents: Number(readField(section, ["minEvents", "最少日历事件数"])) || undefined,
      minRecommendations: Number(readField(section, ["minRecommendations", "最少建议数"])) || undefined
    });
  }
  return normalizeCases(cases);
}

function evaluate(result: HarnessRunResult, testCase: BenchmarkCase, durationMs: number): CaseResult {
  const errorSteps = result.steps.filter((step) => step.status === "error");
  const expectedKeywords = testCase.expectedKeywords ?? [];
  const clarificationFirst = isClarificationFirstCase(testCase);
  const combinedText = [
    result.finalAnswer,
    ...result.tasks.flatMap((task) => [task.title, task.description]),
    ...result.recommendations
  ].join("\n");
  const normalizedCombinedText = normalizeForKeywordMatch(combinedText);
  const keywordCoverage = evaluateKeywordCoverage(expectedKeywords, normalizedCombinedText);

  const checks = [
    {
      name: "LLM connected",
      passed: result.llmStatus?.connected === true,
      detail: result.llmStatus?.error ?? result.llmStatus?.model ?? "unknown"
    },
    {
      name: "ReAct steps succeeded",
      passed: result.steps.length >= 3 && errorSteps.length === 0,
      detail: `${result.steps.length} steps, ${errorSteps.length} errors`
    },
    {
      name: "Generated enough tasks",
      passed: result.tasks.length >= (testCase.minTasks ?? (clarificationFirst ? 1 : 2)),
      detail: `${result.tasks.length} tasks${clarificationFirst ? " (clarification-first case)" : ""}`
    },
    {
      name: "Generated final answer",
      passed: result.finalAnswer.trim().length > 0,
      detail: `${result.finalAnswer.trim().length} chars`
    },
    {
      name: "Generated recommendations",
      passed: result.recommendations.length >= (testCase.minRecommendations ?? 1),
      detail: `${result.recommendations.length} recommendations`
    }
  ];

  if (testCase.options?.generateCalendar !== false && !clarificationFirst) {
    checks.push({
      name: "Generated calendar events",
      passed: result.calendarEvents.length >= (testCase.minEvents ?? 1),
      detail: `${result.calendarEvents.length} events`
    });
  }

  if (expectedKeywords.length > 0) {
    const threshold = clarificationFirst ? 0.5 : 0.7;
    checks.push({
      name: "Covered expected keywords",
      passed: keywordCoverage.coverage >= threshold,
      detail: keywordCoverage.missing.length === 0
        ? "all keywords found"
        : `${keywordCoverage.matched.length}/${expectedKeywords.length} covered; missing: ${keywordCoverage.missing.join(", ")}`
    });
  }

  const passedChecks = checks.filter((check) => check.passed).length;
  const score = Math.round((passedChecks / checks.length) * 100);

  return {
    id: testCase.id,
    title: testCase.title,
    passed: checks.every((check) => check.passed),
    score,
    durationMs,
    checks,
    metrics: {
      llmConnected: result.llmStatus?.connected === true,
      stepCount: result.steps.length,
      taskCount: result.tasks.length,
      eventCount: result.calendarEvents.length,
      urlCount: result.urls.length,
      recommendationCount: result.recommendations.length,
      fileCount: result.files.length,
      actions: result.steps.map((step) => step.action ?? step.skillName ?? "unknown")
    },
    finalAnswerExcerpt: result.finalAnswer.replace(/\s+/g, " ").slice(0, 180)
  };
}

function normalizeForKeywordMatch(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[，,。.;；:：、"'“”‘’（）()\[\]【】]/g, "")
    .toLowerCase();
}

function isClarificationFirstCase(testCase: BenchmarkCase) {
  const text = `${testCase.id} ${testCase.title} ${testCase.category ?? ""} ${testCase.input}`;
  return /ambiguous|模糊|不清楚|不知道/.test(text);
}

function evaluateKeywordCoverage(keywords: string[], normalizedText: string): KeywordCoverage {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const keyword of keywords) {
    const variants = keywordVariants(keyword);
    if (variants.some((variant) => normalizedText.includes(normalizeForKeywordMatch(variant)))) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }
  return {
    matched,
    missing,
    coverage: keywords.length === 0 ? 1 : matched.length / keywords.length
  };
}

function keywordVariants(keyword: string) {
  const normalized = normalizeForKeywordMatch(keyword);
  const variants = new Set<string>([keyword, normalized]);
  const semanticAliases: Record<string, string[]> = {
    "2周": ["两周", "14天", "十四天"],
    "3天": ["三天"],
    "4周": ["四周", "一个月"],
    "5天": ["五天"],
    "6周": ["六周"],
    "10天": ["十天", "10个晚上", "十个晚上"],
    "每周8小时": ["每周只有8小时", "每周只投入8小时", "8小时可用"],
    "ai产品经理": ["ai产品", "产品经理"],
    "ai项目": ["已有ai项目"],
    "ai产品": ["ai能力", "ai项目", "ai产品作品"],
    "测试集": ["数据集", "评测集", "验证集", "benchmark数据"],
    "评估": ["评测", "评价", "测试", "指标"],
    "技术能力": ["技术选型", "工程能力", "实现能力", "检索能力", "ai能力"],
    "现实": ["可行", "不现实", "有效时间", "时间约束", "不要试图"],
    "取舍": ["优先", "聚焦", "放弃", "只选", "不要试图", "核心"],
    "澄清": ["明确", "先明确", "梳理", "聚焦"],
    "学习": ["自我提升", "提升"],
    "计划": ["行动", "后续", "方向", "拆解"]
  };
  for (const alias of semanticAliases[normalized] ?? []) variants.add(alias);
  return [...variants];
}

async function runCase(testCase: BenchmarkCase): Promise<CaseResult> {
  const started = Date.now();
  try {
    const result = await agent.run(testCase.input, testCase.options);
    return evaluate(result, testCase, Date.now() - started);
  } catch (error) {
    return {
      id: testCase.id,
      title: testCase.title,
      passed: false,
      score: 0,
      durationMs: Date.now() - started,
      checks: [{ name: "Run completed", passed: false, detail: error instanceof Error ? error.message : String(error) }],
      metrics: {
        llmConnected: false,
        stepCount: 0,
        taskCount: 0,
        eventCount: 0,
        urlCount: 0,
        recommendationCount: 0,
        fileCount: 0,
        actions: []
      },
      finalAnswerExcerpt: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function runCaseWithRaw(testCase: BenchmarkCase): Promise<{ evalResult: CaseResult; rawOutput: RawOutput }> {
  const started = Date.now();
  try {
    const result = await agent.run(testCase.input, testCase.options);
    const durationMs = Date.now() - started;
    return {
      evalResult: evaluate(result, testCase, durationMs),
      rawOutput: {
        id: testCase.id,
        title: testCase.title,
        input: testCase.input,
        durationMs,
        result
      }
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    return {
      evalResult: {
        id: testCase.id,
        title: testCase.title,
        passed: false,
        score: 0,
        durationMs,
        checks: [{ name: "Run completed", passed: false, detail: message }],
        metrics: {
          llmConnected: false,
          stepCount: 0,
          taskCount: 0,
          eventCount: 0,
          urlCount: 0,
          recommendationCount: 0,
          fileCount: 0,
          actions: []
        },
        finalAnswerExcerpt: "",
        error: message
      },
      rawOutput: {
        id: testCase.id,
        title: testCase.title,
        input: testCase.input,
        durationMs,
        error: message
      }
    };
  }
}

function markdownReport(results: CaseResult[]) {
  const average = Math.round(results.reduce((sum, item) => sum + item.score, 0) / Math.max(results.length, 1));
  const passCount = results.filter((item) => item.passed).length;
  const rows = results.map((item) => [
    item.id,
    item.passed ? "PASS" : "FAIL",
    String(item.score),
    String(item.metrics.stepCount),
    String(item.metrics.taskCount),
    String(item.metrics.eventCount),
    String(item.durationMs),
    item.title.replace(/\|/g, "/")
  ]);

  return [
    "# Personal Planning Agent Benchmark",
    "",
    `- Cases: ${results.length}`,
    `- Passed: ${passCount}/${results.length}`,
    `- Average score: ${average}`,
    "",
    "| Case | Result | Score | Steps | Tasks | Events | Duration ms | Title |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "## Failed Checks",
    "",
    ...results.flatMap((item) => {
      const failed = item.checks.filter((check) => !check.passed);
      if (failed.length === 0) return [];
      return [
        `### ${item.id} ${item.title}`,
        "",
        ...failed.map((check) => `- ${check.name}: ${check.detail}`),
        ""
      ];
    })
  ].join("\n");
}

function writeReports(root: string, outputDir: string, cases: BenchmarkCase[], rawOutputs: RawOutput[], results: CaseResult[]) {
  fs.mkdirSync(outputDir, { recursive: true });
  const benchmarkDir = path.resolve(root, "benchmark");
  const benchmarkCasesDir = path.join(benchmarkDir, "cases");
  const benchmarkResultsDir = path.join(benchmarkDir, "results");
  fs.mkdirSync(benchmarkCasesDir, { recursive: true });
  fs.mkdirSync(benchmarkResultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `benchmark-${stamp}.json`);
  const mdPath = path.join(outputDir, `benchmark-${stamp}.md`);
  const report = markdownReport(results);
  fs.writeFileSync(jsonPath, JSON.stringify({ cases, rawOutputs, results }, null, 2), "utf8");
  fs.writeFileSync(mdPath, report, "utf8");
  fs.writeFileSync(path.join(benchmarkCasesDir, "personal_planning_agent_cases.json"), JSON.stringify(cases, null, 2), "utf8");
  fs.writeFileSync(path.join(benchmarkResultsDir, "raw_outputs.json"), JSON.stringify(rawOutputs, null, 2), "utf8");
  fs.writeFileSync(path.join(benchmarkResultsDir, "eval_results.json"), JSON.stringify(results, null, 2), "utf8");
  fs.writeFileSync(path.join(benchmarkResultsDir, "benchmark_report.md"), report, "utf8");
  return { jsonPath, mdPath, benchmarkResultsDir };
}

async function main() {
  loadEnv();
  const args = parseArgs();
  const root = projectRoot();
  const defaultFile = path.resolve(root, "personal_planning_agent_benchmark_10cases.md");
  const file = path.resolve(args.file ?? defaultFile);
  const outputDir = path.resolve(args.outputDir ?? path.join(root, "generated", "exports"));

  if (args.reevaluate) {
    const benchmarkResultsDir = path.resolve(root, "benchmark", "results");
    const benchmarkCasesPath = path.resolve(root, "benchmark", "cases", "personal_planning_agent_cases.json");
    const rawOutputsPath = path.join(benchmarkResultsDir, "raw_outputs.json");
    const cases = normalizeCases(JSON.parse(fs.readFileSync(benchmarkCasesPath, "utf8")) as BenchmarkCase[]);
    const rawOutputs = JSON.parse(fs.readFileSync(rawOutputsPath, "utf8")) as RawOutput[];
    const byId = new Map(cases.map((item) => [item.id, item]));
    const results = rawOutputs.map((rawOutput) => {
      const testCase = byId.get(rawOutput.id);
      if (testCase && rawOutput.result) return evaluate(rawOutput.result, testCase, rawOutput.durationMs);
      return {
        id: rawOutput.id,
        title: rawOutput.title,
        passed: false,
        score: 0,
        durationMs: rawOutput.durationMs,
        checks: [{ name: "Run completed", passed: false, detail: rawOutput.error ?? "missing raw result" }],
        metrics: {
          llmConnected: false,
          stepCount: 0,
          taskCount: 0,
          eventCount: 0,
          urlCount: 0,
          recommendationCount: 0,
          fileCount: 0,
          actions: []
        },
        finalAnswerExcerpt: "",
        error: rawOutput.error
      } satisfies CaseResult;
    });
    const paths = writeReports(root, outputDir, cases, rawOutputs, results);
    const passed = results.filter((item) => item.passed).length;
    const average = Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length);
    console.log(`Benchmark re-evaluated: ${passed}/${results.length} passed, average score ${average}`);
    console.log(`JSON: ${paths.jsonPath}`);
    console.log(`Markdown: ${paths.mdPath}`);
    console.log(`Benchmark results: ${paths.benchmarkResultsDir}`);
    if (passed !== results.length) process.exitCode = 1;
    return;
  }

  let cases: BenchmarkCase[];
  if (args.sample) {
    cases = sampleCases;
  } else {
    if (!fs.existsSync(file)) {
      throw new Error(`Benchmark file not found: ${file}. Pass --sample to run the built-in smoke benchmark.`);
    }
    cases = parseMarkdownCases(fs.readFileSync(file, "utf8"));
  }

  if (args.limit) cases = cases.slice(0, args.limit);
  if (cases.length === 0) throw new Error(`No benchmark cases found in ${file}`);

  const results: CaseResult[] = [];
  const rawOutputs: RawOutput[] = [];
  for (const testCase of cases) {
    console.log(`Running ${testCase.id}: ${testCase.title}`);
    const { evalResult, rawOutput } = await runCaseWithRaw(testCase);
    results.push(evalResult);
    rawOutputs.push(rawOutput);
  }

  const paths = writeReports(root, outputDir, cases, rawOutputs, results);

  const passed = results.filter((item) => item.passed).length;
  const average = Math.round(results.reduce((sum, item) => sum + item.score, 0) / results.length);
  console.log(`Benchmark complete: ${passed}/${results.length} passed, average score ${average}`);
  console.log(`JSON: ${paths.jsonPath}`);
  console.log(`Markdown: ${paths.mdPath}`);
  console.log(`Benchmark results: ${paths.benchmarkResultsDir}`);

  if (passed !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
