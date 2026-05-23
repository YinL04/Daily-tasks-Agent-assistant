# 个人事务规划 Agent Benchmark 测试任务说明（10 Cases 精简版）

> 使用方式：把本 Markdown 文件直接交给 Codex / Claude Code / Cursor Agent，让它在你的项目仓库中执行。  
> 目标：为「个人事务规划 Agent」建立一套可重复运行的离线 Benchmark，自动调用 Agent、对比输出质量，并生成可写进简历/面试材料的测试报告。

---

## 0. Codex 任务

你现在是一个代码测试与评估 Agent。请在当前项目仓库中完成以下事情：

1. 阅读项目结构，识别「个人事务规划 Agent」的运行入口。
2. 如果已有 CLI / API / 函数入口，优先复用。
3. 如果没有明确入口，请新增一个最小测试适配层，不破坏原项目逻辑。
4. 基于本文档中的 10 个 Benchmark 用例运行测试。
5. 自动对比 Agent 输出和预期要求。
6. 生成结构化测试结果：
   - `benchmark/results/raw_outputs.json`
   - `benchmark/results/eval_results.json`
   - `benchmark/results/benchmark_report.md`
7. 最后在终端输出摘要指标，方便写进简历。

---

## 1. 项目背景

本项目是一个「个人事务规划 Agent」，目标是支持用户通过自然语言输入学习、旅行、项目、求职、考试等目标，自动生成：

- 任务拆解
- 优先级排序
- 日历 / 时间安排
- 资料 / 网址 / 工具建议
- 可下载计划文件或结构化计划
- 风险提醒或执行建议

本 Benchmark 的目的不是评估模型“文采好不好”，而是评估 Agent 是否能稳定产出一个**可执行、结构化、可复用**的个人事务计划。

---

## 2. 建议目录结构

请新增以下目录和文件：

```text
benchmark/
  cases/
    personal_planning_agent_cases.json
  results/
    raw_outputs.json
    eval_results.json
    benchmark_report.md
  agent_adapter.py
  run_benchmark.py
  evaluate_outputs.py
```

---

## 3. Agent 调用适配要求

请先自动识别项目入口。优先顺序如下：

1. 如果存在 CLI 命令，例如：
   - `python main.py`
   - `python app.py`
   - `python agent.py`
   - `python -m xxx`
   - `npm run xxx`

   请尝试复用。

2. 如果存在函数入口，例如：
   - `plan_goal(user_input)`
   - `run_agent(user_input)`
   - `generate_plan(user_input)`
   - `agent.invoke(...)`
   - `agent.run(...)`

   请在 `benchmark/agent_adapter.py` 中导入并调用。

3. 如果无法自动确定入口，请创建以下适配层：

```python
# benchmark/agent_adapter.py

def run_agent(user_input: str) -> str:
    \"\"\"
    TODO: 请在这里接入项目中的个人事务规划 Agent。
    返回值必须是字符串，代表 Agent 的完整输出。
    \"\"\"
    raise NotImplementedError("请在 benchmark/agent_adapter.py 中接入项目 Agent 入口")
```

要求：

- 不要破坏原项目已有代码。
- 不要把 API Key 写入代码。
- 如果需要环境变量，请在报告中说明。
- Agent 输出可以是 Markdown、JSON 或普通文本，但必须转换成字符串后保存。

---

## 4. Benchmark 用例

请将以下内容保存为：

`benchmark/cases/personal_planning_agent_cases.json`

```json
[
  {
    "id": "study_001",
    "category": "学习规划",
    "user_input": "我想在 2 周内入门 AI 产品经理，平时每天晚上有 2 小时，周末每天有 5 小时，帮我做一个学习计划。",
    "time_constraint": "2 周",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["AI 产品经理", "2 周", "每天", "周末", "竞品分析", "PRD", "原型"],
    "notes": "应包含基础认知、竞品分析、PRD/原型练习、项目包装等。"
  },
  {
    "id": "study_002",
    "category": "学习规划",
    "user_input": "我还有 10 天数据库考试，基础一般，白天有课，只能晚上复习。请帮我安排复习计划。",
    "time_constraint": "10 天",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["数据库", "10 天", "晚上", "SQL", "事务", "索引", "复习"],
    "notes": "应体现考试复习优先级，不应安排过量任务。"
  },
  {
    "id": "career_001",
    "category": "求职规划",
    "user_input": "我想 6 周内准备好 AI 产品经理实习投递，包括简历、项目包装、面试准备和投递节奏，请帮我规划。",
    "time_constraint": "6 周",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["AI 产品经理", "实习", "6 周", "简历", "项目包装", "面试", "投递"],
    "notes": "应包含简历优化、项目 STAR、岗位分析、模拟面试和投递节奏。"
  },
  {
    "id": "career_002",
    "category": "求职规划",
    "user_input": "我现在有几个 AI 项目，但没有实习结果指标。请帮我规划 2 周内如何补 Benchmark 和简历数据。",
    "time_constraint": "2 周",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["AI 项目", "Benchmark", "简历", "2 周", "指标", "测试集", "评估"],
    "notes": "应包含测试集构建、评分规则、数据统计和简历表达。"
  },
  {
    "id": "project_001",
    "category": "项目规划",
    "user_input": "我想 4 周内做一个基于 RAG 的足球问答助手，用来展示我的 AI 产品和技术能力，请帮我拆解任务。",
    "time_constraint": "4 周",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["RAG", "足球问答", "4 周", "AI 产品", "技术能力", "检索", "评估"],
    "notes": "应包含需求定义、技术链路、数据源、评估、Demo 和简历包装。"
  },
  {
    "id": "project_002",
    "category": "项目规划",
    "user_input": "我想在 10 天内把一个已有 GitHub Demo 改造成更像产品的项目，包括 README、Demo 视频、指标和面试讲法。",
    "time_constraint": "10 天",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["GitHub Demo", "产品", "README", "Demo 视频", "指标", "面试", "10 天"],
    "notes": "应包含产品包装、文档、评估指标和展示材料。"
  },
  {
    "id": "travel_001",
    "category": "旅行规划",
    "user_input": "我想做一个 3 天东京旅行计划，预算中等，喜欢动漫、咖啡店和城市散步，不想行程太赶。",
    "time_constraint": "3 天",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["东京", "3 天", "预算中等", "动漫", "咖啡店", "城市散步", "不赶"],
    "notes": "应包含每天行程、区域安排、节奏控制和备选方案。"
  },
  {
    "id": "travel_002",
    "category": "旅行规划",
    "user_input": "我计划 5 天去关西旅行，想去大阪、京都和奈良，第一次去日本，帮我安排路线和准备事项。",
    "time_constraint": "5 天",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["关西", "大阪", "京都", "奈良", "5 天", "第一次", "路线"],
    "notes": "应包含城市顺序、每日路线、交通准备、风险提醒。"
  },
  {
    "id": "constraint_001",
    "category": "复杂约束",
    "user_input": "我想 4 周内准备一个 AI 产品作品集，但我每周只有 8 小时，而且中间有一周要考试，请帮我安排一个现实一点的计划。",
    "time_constraint": "4 周",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["4 周", "AI 产品作品集", "每周 8 小时", "考试", "现实", "取舍"],
    "notes": "应体现时间限制和取舍，不能安排过重任务。"
  },
  {
    "id": "ambiguous_001",
    "category": "模糊输入",
    "user_input": "我想提升自己，帮我规划一下。",
    "time_constraint": "不明确",
    "expected_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources", "risks"],
    "must_cover_keywords": ["澄清", "目标", "学习", "健康", "职业", "计划"],
    "notes": "应主动说明假设，给出通用初版计划，并提示用户补充信息。"
  }
]
```

---

## 5. 评估指标

请对每条 case 输出以下指标：

```json
{
  "id": "study_001",
  "category": "学习规划",
  "output_completeness": 0.86,
  "matched_elements": ["goal_understanding", "task_breakdown", "priority", "schedule", "deliverables", "resources"],
  "missing_elements": ["risks"],
  "structure_pass": true,
  "keyword_coverage": 0.71,
  "task_breakdown_score": 4,
  "schedule_feasibility_score": 4,
  "usability_score": 4,
  "has_hallucination_or_error": false,
  "overall_score": 4.1,
  "notes": "任务拆解较完整，但风险提醒略弱。"
}
```

---

## 6. 评分规则

### 6.1 输出完整率 Output Completeness

判断输出是否包含以下 7 个关键模块：

| 模块 | 说明 | 可用于规则匹配的关键词 |
|---|---|---|
| goal_understanding | 是否理解 / 复述用户目标 | 目标、你想、需求、背景、理解 |
| task_breakdown | 是否拆解任务 | 任务、步骤、拆解、行动、执行 |
| priority | 是否体现优先级 | 优先级、先、重点、核心、必须、可选 |
| schedule | 是否给出时间安排 | 日程、安排、时间、每天、每周、第1天、第1周、阶段 |
| deliverables | 是否说明产出物 | 交付物、成果、输出、完成、作品、文档、报告 |
| resources | 是否提供资源建议 | 资源、资料、工具、链接、网址、课程、模板 |
| risks | 是否提示风险或注意事项 | 风险、注意、避免、备选、限制、不要、提醒 |

计算：

```text
输出完整率 = 命中的模块数 / 7
```

---

### 6.2 结构化格式稳定率 Structure Stability

满足以下任意 3 项即可认为结构化合格：

- 有标题或分节
- 有列表、表格或编号步骤
- 有阶段划分
- 有时间线或日历安排
- 有优先级字段
- 有总结或下一步行动

输出：

```json
"structure_pass": true
```

---

### 6.3 关键词覆盖率 Keyword Coverage

每个 case 都有 `must_cover_keywords`。

计算：

```text
关键词覆盖率 = 输出中命中的 must_cover_keywords 数量 / must_cover_keywords 总数
```

注意：

- 中文关键词可直接字符串匹配。
- 英文关键词大小写不敏感。
- 如果 Agent 使用近义词，可以在 `evaluate_outputs.py` 中加同义词表，但必须在报告中说明。

---

### 6.4 任务拆解合理性 Task Breakdown Score

1-5 分：

| 分数 | 标准 |
|---|---|
| 5 | 拆解具体、可执行、顺序合理，能直接照做 |
| 4 | 拆解较清晰，有少量泛化内容 |
| 3 | 有任务拆解，但粒度不稳定或缺少关键步骤 |
| 2 | 任务较笼统，缺少可执行性 |
| 1 | 基本没有任务拆解 |

规则辅助判断：

- 至少 5 个具体任务，分数不低于 3。
- 出现“调研、整理、完成、设计、复习、预订、投递、修改、练习、提交、输出、制作”等动作词，适当加分。
- 如果大量出现“努力、坚持、保持、提升自己”等泛化表达，适当扣分。

---

### 6.5 时间安排可执行性 Schedule Feasibility Score

1-5 分：

| 分数 | 标准 |
|---|---|
| 5 | 时间安排具体、符合目标周期、任务负载合理 |
| 4 | 时间安排较合理，但细节略少 |
| 3 | 有阶段安排，但不够具体 |
| 2 | 只有笼统时间建议 |
| 1 | 没有时间安排 |

规则辅助判断：

- 是否识别用户时间限制，例如 3 天、2 周、4 周、6 周、10 天。
- 是否把任务分配到日期、周、阶段或每日安排中。
- 是否考虑约束，例如每天 2 小时、每周 8 小时、中间有考试、不想太赶等。
- 如果安排明显违反限制，需要扣分并记录原因。

---

### 6.6 用户可用性 Usability Score

1-5 分：

| 分数 | 标准 |
|---|---|
| 5 | 用户几乎可以直接执行 |
| 4 | 稍作修改即可执行 |
| 3 | 有参考价值，但需要用户大量补充 |
| 2 | 过于泛泛，执行成本高 |
| 1 | 基本不可用 |

规则辅助判断：

- 是否有明确下一步行动。
- 是否有阶段性交付物。
- 是否能让用户今天就开始执行。
- 是否结合了用户约束。
- 是否避免过度泛化。

---

### 6.7 幻觉与错误 Hallucination / Error

如果输出包含以下问题，标记为：

```json
"has_hallucination_or_error": true
```

需要检查：

- 编造不存在的用户信息。
- 无根据承诺真实预订、投递、报名等外部动作已经完成。
- 虚构具体链接、机构、价格、考试时间等。
- 和用户目标明显冲突。
- 时间安排违反用户限制。
- 对模糊输入不说明假设，直接编造具体背景。

---

## 7. Overall Score 计算方式

建议使用以下加权方式：

```text
overall_score =
  output_completeness * 5 * 0.25
  + keyword_coverage * 5 * 0.15
  + task_breakdown_score * 0.25
  + schedule_feasibility_score * 0.20
  + usability_score * 0.15
```

如果 `has_hallucination_or_error = true`，则：

```text
overall_score = overall_score - 0.5
```

最低不低于 1，最高不超过 5。

---

## 8. run_benchmark.py 实现要求

请实现：

1. 读取 `benchmark/cases/personal_planning_agent_cases.json`
2. 对每个 case 调用 `run_agent(user_input)`
3. 保存原始输出到 `benchmark/results/raw_outputs.json`
4. 调用评估函数
5. 保存评估结果到 `benchmark/results/eval_results.json`
6. 生成 Markdown 报告 `benchmark/results/benchmark_report.md`

伪代码：

```python
import json
from pathlib import Path
from benchmark.agent_adapter import run_agent
from benchmark.evaluate_outputs import evaluate_case, build_report

CASES_PATH = Path("benchmark/cases/personal_planning_agent_cases.json")
RAW_PATH = Path("benchmark/results/raw_outputs.json")
EVAL_PATH = Path("benchmark/results/eval_results.json")
REPORT_PATH = Path("benchmark/results/benchmark_report.md")

def main():
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    raw_outputs = []

    for case in cases:
        output = run_agent(case["user_input"])
        raw_outputs.append({
            "id": case["id"],
            "category": case["category"],
            "user_input": case["user_input"],
            "output": output
        })

    RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
    RAW_PATH.write_text(json.dumps(raw_outputs, ensure_ascii=False, indent=2), encoding="utf-8")

    eval_results = []
    for case, raw in zip(cases, raw_outputs):
        eval_results.append(evaluate_case(case, raw["output"]))

    EVAL_PATH.write_text(json.dumps(eval_results, ensure_ascii=False, indent=2), encoding="utf-8")

    report = build_report(cases, raw_outputs, eval_results)
    REPORT_PATH.write_text(report, encoding="utf-8")

    print(report)

if __name__ == "__main__":
    main()
```

---

## 9. evaluate_outputs.py 实现要求

请实现以下函数：

```python
def evaluate_case(case: dict, output: str) -> dict:
    pass

def build_report(cases: list, raw_outputs: list, eval_results: list) -> str:
    pass
```

### build_report 至少包含：

1. Benchmark 基本信息
   - 测试总数
   - 覆盖类别
   - 测试时间

2. 总体指标
   - 平均 Overall Score
   - 平均输出完整率
   - 结构化通过率
   - 平均关键词覆盖率
   - 平均任务拆解评分
   - 平均时间安排评分
   - 平均用户可用性评分
   - 幻觉 / 错误率

3. 分类别指标
   - 学习规划
   - 求职规划
   - 项目规划
   - 旅行规划
   - 复杂约束
   - 模糊输入

4. 每条 case 的结果表格

5. 可直接写进简历的总结语，例如：

```text
基于 10 条多类别目标规划 Benchmark 完成离线评测，覆盖学习、求职、项目、旅行、复杂约束与模糊输入场景；Agent 平均输出完整率 XX%，结构化通过率 XX%，任务拆解合理性平均评分 X.X/5，整体可用性评分 X.X/5。
```

6. 主要问题和下一步优化建议。

---

## 10. 报告模板

请生成类似以下格式：

```markdown
# 个人事务规划 Agent Benchmark Report

## 1. Overview

- Test cases: 10
- Categories: 学习规划、求职规划、项目规划、旅行规划、复杂约束、模糊输入
- Evaluation method: Rule-based offline benchmark
- Date: YYYY-MM-DD

## 2. Summary Metrics

| Metric | Value |
|---|---:|
| Average Overall Score | 4.10 / 5 |
| Average Output Completeness | 87.1% |
| Structure Pass Rate | 90.0% |
| Average Keyword Coverage | 78.4% |
| Average Task Breakdown Score | 4.2 / 5 |
| Average Schedule Feasibility Score | 4.0 / 5 |
| Average Usability Score | 4.1 / 5 |
| Hallucination / Error Rate | 0.0% |

## 3. Category Results

| Category | Cases | Avg Overall | Avg Completeness | Structure Pass Rate |
|---|---:|---:|---:|---:|
| 学习规划 | 2 | 4.2 | 90.0% | 100.0% |
| 求职规划 | 2 | 4.1 | 85.7% | 100.0% |
| 项目规划 | 2 | 4.0 | 85.7% | 100.0% |
| 旅行规划 | 2 | 3.9 | 82.9% | 100.0% |
| 复杂约束 | 1 | 4.2 | 90.0% | 100.0% |
| 模糊输入 | 1 | 3.8 | 78.6% | 100.0% |

## 4. Case Details

| ID | Category | Overall | Completeness | Keyword Coverage | Structure | Error |
|---|---|---:|---:|---:|---|---|
| study_001 | 学习规划 | 4.2 | 85.7% | 71.4% | Pass | No |

## 5. Resume-ready Summary

基于 10 条多类别目标规划 Benchmark 完成离线评测，覆盖学习、求职、项目、旅行、复杂约束与模糊输入场景；Agent 平均输出完整率 XX%，结构化通过率 XX%，任务拆解合理性平均评分 X.X/5，整体可用性评分 X.X/5。

## 6. Findings

- Strengths:
  - ...
- Weaknesses:
  - ...
- Next Steps:
  - ...
```

---

## 11. 最终交付物检查清单

请确保最终生成：

- [ ] `benchmark/cases/personal_planning_agent_cases.json`
- [ ] `benchmark/agent_adapter.py`
- [ ] `benchmark/run_benchmark.py`
- [ ] `benchmark/evaluate_outputs.py`
- [ ] `benchmark/results/raw_outputs.json`
- [ ] `benchmark/results/eval_results.json`
- [ ] `benchmark/results/benchmark_report.md`

如果项目暂时无法成功调用 Agent，请至少完成：

- [ ] cases 文件
- [ ] agent_adapter.py TODO 适配层
- [ ] evaluate_outputs.py
- [ ] run_benchmark.py
- [ ] 在报告中说明还需要接入 Agent 入口

---

## 12. 注意事项

- 不要编造测试结果。
- 不要把 API Key 写入代码。
- 不要删除或大改原项目代码。
- 所有测试结果必须来自真实运行输出。
- 如果某些输出依赖联网或模型 API，请在报告中说明运行环境。
- 如果 Agent 输出不稳定，建议连续运行 2 次，但报告中要明确说明是单次测试还是多次平均。
