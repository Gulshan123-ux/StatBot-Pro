"""
StatBot Pro — Autonomous CSV Analyst Agent Service.
Uses LangChain + GPT-4 with a custom sandboxed Python REPL tool.
Supports self-correction: retries on code errors up to MAX_ITERATIONS.
"""

import os
import uuid
import time
import asyncio
import json
import pandas as pd
from typing import Optional, Any, AsyncGenerator

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.tools import Tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage
from langchain_core.callbacks import AsyncCallbackHandler

from app.utils.sandbox import SandboxedREPL
from app.models.schemas import AnalysisResponse, AnalysisStatus, ChartInfo



SYSTEM_PROMPT = """You are StatBot Pro, an expert autonomous data analyst.
You have access to a pandas DataFrame called `df` loaded from a user-uploaded CSV file.

Your job:
1. Understand the user's analytical question.
2. Write clean, correct Python/pandas code to answer it.
3. Use the `execute_python` tool to run the code.
4. If the code produces an error, READ the error carefully, FIX the code, and try again.
5. You may iterate up to {max_iterations} times to self-correct.
6. For visualizations, use matplotlib/seaborn and call `save_chart(title="Your Chart Title")` to save the figure.
7. Always print() your final answer so it appears in the output.

DataFrame info:
{df_info}

Rules:
- NEVER use os, subprocess, open(), or any file system operations.
- NEVER use requests, urllib, or network calls.
- Only use: pandas (pd), numpy (np), matplotlib (plt), seaborn (sns), and the `save_chart` helper.
- Keep code clean and well-commented.
- If data is missing or ambiguous, state your assumptions clearly.
"""


def _build_df_info(df: pd.DataFrame) -> str:
    info_lines = [
        f"Shape: {df.shape[0]} rows × {df.shape[1]} columns",
        f"Columns: {list(df.columns)}",
        "Dtypes:",
    ]
    for col, dtype in df.dtypes.items():
        nulls = df[col].isna().sum()
        info_lines.append(f"  - {col}: {dtype} ({nulls} nulls)")
    info_lines.append("\nFirst 3 rows (as dict):")
    info_lines.append(df.head(3).to_string())
    return "\n".join(info_lines)


class StreamingAgentCallbackHandler(AsyncCallbackHandler):
    def __init__(self, queue: asyncio.Queue):
        self.queue = queue

    async def on_agent_action(self, action: Any, **kwargs: Any) -> None:
        tool_input = getattr(action, "tool_input", "")
        log = getattr(action, "log", "")
        thought = ""
        if "Thought:" in log:
            thought = log.split("Thought:")[1].split("Action:")[0].strip()
        else:
            thought = log.strip()
            
        await self.queue.put({
            "type": "thought",
            "thought": thought,
            "code": tool_input
        })

    async def on_tool_end(self, output: str, **kwargs: Any) -> None:
        await self.queue.put({
            "type": "tool_end",
            "output": output
        })

    async def on_tool_error(self, error: Exception | KeyboardInterrupt, **kwargs: Any) -> None:
        await self.queue.put({
            "type": "error",
            "error": str(error)
        })

    async def on_agent_finish(self, finish: Any, **kwargs: Any) -> None:
        await self.queue.put({
            "type": "finish",
            "output": getattr(finish, "return_values", {}).get("output", "")
        })


class CSVAnalystAgent:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.openai_api_base = os.getenv("OPENAI_API_BASE", "")  # e.g. https://api.novita.ai/v3/openai
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")
        self.max_iterations = int(os.getenv("MAX_ITERATIONS", "10"))
        self.charts_dir = os.getenv("CHARTS_DIR", "static/charts")
        self.charts_base_url = os.getenv("CHARTS_BASE_URL", "http://localhost:8000/static/charts")

    async def analyze_stream(
        self, df: pd.DataFrame, question: str, session_id: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        session_id = session_id or uuid.uuid4().hex
        start_time = time.time()

        if (
            not self.openai_api_key
            or self.openai_api_key.startswith("sk-your")
            or "YOUR_" in self.openai_api_key
            or "KEY_HERE" in self.openai_api_key
        ):
            yield json.dumps({"type": "info", "message": "Using local fallback engine (no API key)"}) + "\n"
            await asyncio.sleep(0.5)
            
            yield json.dumps({"type": "thought", "thought": "Analyzing columns and determining the best local script execution plan.", "code": ""}) + "\n"
            await asyncio.sleep(1.0)
            
            local_res = self._run_local_analysis(df, question, session_id)
            
            yield json.dumps({"type": "thought", "thought": "Running Python code locally using Pandas and Matplotlib...", "code": local_res.code_executed}) + "\n"
            await asyncio.sleep(0.8)
            
            charts_data = [{"filename": c.filename, "url": c.url, "title": c.title} for c in local_res.charts]
            yield json.dumps({
                "type": "final_answer",
                "session_id": session_id,
                "status": "success",
                "question": question,
                "answer": local_res.answer,
                "charts": charts_data,
                "code_executed": local_res.code_executed,
                "iterations": 1,
                "execution_time_ms": int((time.time() - start_time) * 1000)
            }) + "\n"
            return

        repl = SandboxedREPL(self.charts_dir, self.charts_base_url)
        tool, results_store = self._make_repl_tool(df, repl)

        df_info = _build_df_info(df)
        system_msg = SYSTEM_PROMPT.format(
            df_info=df_info, max_iterations=self.max_iterations
        )

        llm_kwargs = dict(
            model=self.model,
            temperature=0,
            api_key=self.openai_api_key,
        )
        if self.openai_api_base:
            llm_kwargs["base_url"] = self.openai_api_base
        llm = ChatOpenAI(**llm_kwargs)

        prompt = ChatPromptTemplate.from_messages(
            [
                SystemMessage(content=system_msg),
                MessagesPlaceholder(variable_name="chat_history", optional=True),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ]
        )

        agent = create_openai_tools_agent(llm, [tool], prompt)
        executor = AgentExecutor(
            agent=agent,
            tools=[tool],
            max_iterations=self.max_iterations,
            verbose=True,
            handle_parsing_errors=True,
            return_intermediate_steps=True,
        )

        queue = asyncio.Queue()
        callback = StreamingAgentCallbackHandler(queue)

        # Run the agent in the background
        task = asyncio.create_task(
            executor.ainvoke(
                {"input": question},
                config={"callbacks": [callback]}
            )
        )

        # Stream intermediate events
        try:
            while not task.done() or not queue.empty():
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=0.1)
                    yield json.dumps(item) + "\n"
                    queue.task_done()
                except asyncio.TimeoutError:
                    continue

            # Wait for final result
            await task
            result = task.result()

            answer = result.get("output", "No answer generated.")
            code_snippets = []
            for action, _ in result.get("intermediate_steps", []):
                if hasattr(action, "tool_input"):
                    code_snippets.append(action.tool_input)

            charts = [
                {"filename": c["filename"], "url": c["url"], "title": c["title"]} for c in results_store["charts"]
            ]
            elapsed_ms = int((time.time() - start_time) * 1000)

            yield json.dumps({
                "type": "final_answer",
                "session_id": session_id,
                "status": "success",
                "question": question,
                "answer": answer,
                "charts": charts,
                "code_executed": "\n\n# --- next iteration ---\n\n".join(code_snippets),
                "iterations": len(result.get("intermediate_steps", [])),
                "execution_time_ms": elapsed_ms,
            }) + "\n"

        except Exception as e:
            err_str = str(e)
            elapsed_ms = int((time.time() - start_time) * 1000)

            if "429" in err_str or "insufficient_quota" in err_str or "quota" in err_str.lower():
                yield json.dumps({"type": "info", "message": "Rate limit or quota exceeded. Falling back to local execution..."}) + "\n"
                local_res = self._run_local_analysis(df, question, session_id)
                charts_data = [{"filename": c.filename, "url": c.url, "title": c.title} for c in local_res.charts]
                yield json.dumps({
                    "type": "final_answer",
                    "session_id": session_id,
                    "status": "success",
                    "question": question,
                    "answer": local_res.answer,
                    "charts": charts_data,
                    "code_executed": local_res.code_executed,
                    "iterations": 1,
                    "execution_time_ms": elapsed_ms
                }) + "\n"
            elif "401" in err_str or "FAILED_TO_AUTH" in err_str or "AuthenticationError" in err_str:
                yield json.dumps({
                    "type": "final_answer",
                    "session_id": session_id,
                    "status": "error",
                    "question": question,
                    "error": (
                        "🔑 **API Key Authentication Failed (401)**\n\n"
                        f"Your key was rejected by the AI provider (`{self.openai_api_base or 'api.openai.com'}`)."
                        "\n\n**To fix:**\n"
                        "1. Open `backend/.env`\n"
                        "2. Replace `OPENAI_API_KEY` with a valid key\n"
                        "3. The backend will auto-reload\n"
                    ),
                    "execution_time_ms": elapsed_ms,
                }) + "\n"
            else:
                yield json.dumps({
                    "type": "final_answer",
                    "session_id": session_id,
                    "status": "error",
                    "question": question,
                    "error": err_str,
                    "execution_time_ms": elapsed_ms,
                }) + "\n"


    def _make_repl_tool(self, df: pd.DataFrame, repl: SandboxedREPL):
        """Create a LangChain Tool wrapping the sandboxed REPL."""
        results_store = {"charts": [], "last_output": ""}

        def run_code(code: str) -> str:
            result = repl.execute(code, df)
            results_store["charts"].extend(result.get("charts", []))

            if result["error"]:
                return f"ERROR:\n{result['error']}"

            output = result["output"] or "(Code ran successfully, no printed output)"
            results_store["last_output"] = output

            chart_notes = ""
            if result["charts"]:
                urls = [c["url"] for c in result["charts"]]
                chart_notes = f"\n\n📊 Chart(s) saved: {urls}"

            return output + chart_notes

        tool = Tool(
            name="execute_python",
            func=run_code,
            description=(
                "Execute Python/pandas code to analyze the CSV DataFrame `df`. "
                "Use save_chart(title='...') to save matplotlib figures. "
                "Returns stdout output or error messages."
            ),
        )

        return tool, results_store

    async def analyze(
        self, df: pd.DataFrame, question: str, session_id: Optional[str] = None
    ) -> AnalysisResponse:
        session_id = session_id or uuid.uuid4().hex
        start_time = time.time()

        if (
            not self.openai_api_key
            or self.openai_api_key.startswith("sk-your")
            or "YOUR_" in self.openai_api_key
            or "KEY_HERE" in self.openai_api_key
        ):
            return self._run_local_analysis(df, question, session_id)


        repl = SandboxedREPL(self.charts_dir, self.charts_base_url)
        tool, results_store = self._make_repl_tool(df, repl)

        df_info = _build_df_info(df)
        system_msg = SYSTEM_PROMPT.format(
            df_info=df_info, max_iterations=self.max_iterations
        )

        llm_kwargs = dict(
            model=self.model,
            temperature=0,
            api_key=self.openai_api_key,
        )
        if self.openai_api_base:
            llm_kwargs["base_url"] = self.openai_api_base
        llm = ChatOpenAI(**llm_kwargs)

        prompt = ChatPromptTemplate.from_messages(
            [
                SystemMessage(content=system_msg),
                MessagesPlaceholder(variable_name="chat_history", optional=True),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ]
        )

        agent = create_openai_tools_agent(llm, [tool], prompt)
        executor = AgentExecutor(
            agent=agent,
            tools=[tool],
            max_iterations=self.max_iterations,
            verbose=True,
            handle_parsing_errors=True,
            return_intermediate_steps=True,
        )

        try:
            result = await executor.ainvoke({"input": question})
            answer = result.get("output", "No answer generated.")

            # Collect all code snippets from intermediate steps
            code_snippets = []
            for action, _ in result.get("intermediate_steps", []):
                if hasattr(action, "tool_input"):
                    code_snippets.append(action.tool_input)

            charts = [
                ChartInfo(**c) for c in results_store["charts"]
            ]

            elapsed_ms = int((time.time() - start_time) * 1000)

            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.SUCCESS,
                question=question,
                answer=answer,
                charts=charts,
                code_executed="\n\n# --- next iteration ---\n\n".join(code_snippets),
                iterations=len(result.get("intermediate_steps", [])),
                execution_time_ms=elapsed_ms,
            )

        except Exception as e:
            err_str = str(e)
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            # Handle rate limit / quota exceeded errors
            if "429" in err_str or "insufficient_quota" in err_str or "quota" in err_str.lower():
                return self._run_local_analysis(df, question, session_id)

            # Surface auth errors with a clear, actionable message
            if "401" in err_str or "FAILED_TO_AUTH" in err_str or "AuthenticationError" in err_str:
                return AnalysisResponse(
                    session_id=session_id,
                    status=AnalysisStatus.ERROR,
                    question=question,
                    error=(
                        "🔑 **API Key Authentication Failed (401)**\n\n"
                        f"Your key was rejected by the AI provider (`{self.openai_api_base or 'api.openai.com'}`)."
                        "\n\n**To fix:**\n"
                        "1. Open `backend/.env`\n"
                        "2. Replace `OPENAI_API_KEY` with a valid key\n"
                        "3. The backend will auto-reload\n"
                    ),
                    execution_time_ms=elapsed_ms,
                )
            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.ERROR,
                question=question,
                error=err_str,
                execution_time_ms=elapsed_ms,
            )

    def _run_local_analysis(self, df: pd.DataFrame, question: str, session_id: str) -> AnalysisResponse:
        """Runs the analysis locally using the sandboxed REPL for common query intents when API key has no quota."""
        start_time = time.time()
        repl = SandboxedREPL(self.charts_dir, self.charts_base_url)
        
        num_cols = list(df.select_dtypes(include=['number']).columns)
        str_cols = list(df.select_dtypes(include=['object', 'category']).columns)
        
        q_lower = question.lower()
        code = ""
        intent = "summary"
        
        # Determine best category and numeric columns
        cat = str_cols[0] if str_cols else (df.columns[0] if len(df.columns) > 0 else "")
        val = num_cols[0] if num_cols else (df.columns[0] if len(df.columns) > 0 else "")
        
        for c in str_cols:
            if 'segment' in c.lower() or 'cat' in c.lower() or 'name' in c.lower() or 'type' in c.lower():
                cat = c
                break
        for c in num_cols:
            if 'revenue' in c.lower() or 'sales' in c.lower() or 'total' in c.lower() or 'customers' in c.lower() or 'count' in c.lower():
                val = c
                break

        if "chart" in q_lower or "plot" in q_lower or "visualize" in q_lower or "bar" in q_lower or "graph" in q_lower:
            intent = "chart"
            if cat and val and cat != val:
                code = f"""import matplotlib.pyplot as plt
import seaborn as sns

# Group by '{cat}' and calculate total '{val}'
data = df.groupby('{cat}')['{val}'].sum().sort_values(ascending=False).head(10)

plt.figure(figsize=(9, 5))
sns.barplot(x=data.values, y=data.index, hue=data.index, legend=False, palette='viridis')
plt.title("Total {val} by {cat}", fontsize=13, fontweight='bold', pad=12)
plt.xlabel("{val}", fontsize=10)
plt.ylabel("{cat}", fontsize=10)
plt.grid(axis='x', linestyle='--', alpha=0.3)
plt.tight_layout()

save_chart(title="Most Frequent Categories ({cat} by {val})")
print(f"Grouped breakdown of {val} by {cat}:")
print(data.to_string())
"""
            elif num_cols:
                # Distribution of first numeric column
                code = f"""import matplotlib.pyplot as plt
import seaborn as sns

plt.figure(figsize=(9, 5))
sns.histplot(df['{val}'].dropna(), kde=True, color='teal')
plt.title("Distribution of {val}", fontsize=13, fontweight='bold', pad=12)
plt.xlabel("{val}", fontsize=10)
plt.ylabel("Frequency", fontsize=10)
plt.grid(axis='y', linestyle='--', alpha=0.3)
plt.tight_layout()

save_chart(title="Distribution of {val}")
print(f"Descriptive statistics for {val}:")
print(df['{val}'].describe().to_string())
"""
            else:
                code = f"""print("No suitable columns found for plotting.")"""
        elif "top" in q_lower or "highest" in q_lower or "best" in q_lower or "largest" in q_lower:
            intent = "top"
            code = f"""# Sort by highest values of {val}
top_data = df.sort_values(by='{val}', ascending=False).head(5)
print(f"Top 5 rows sorted by {val}:")
print(top_data.to_string(index=False))
"""
        elif "correlation" in q_lower or "relate" in q_lower or "corr" in q_lower:
            intent = "correlation"
            if len(num_cols) >= 2:
                code = f"""# Compute correlation matrix
corr = df[{num_cols[:8]}].corr()
print("Correlation matrix for numeric features:")
print(corr.to_string())
"""
            else:
                code = f"""print("Insufficient numeric columns to compute correlation.")"""
        elif "summary" in q_lower or "statistics" in q_lower or "describe" in q_lower or "stats" in q_lower:
            intent = "summary"
            code = f"""# Descriptive statistics summary
summary = df.describe()
print("Descriptive statistics for the dataset:")
print(summary.to_string())
"""
        else:
            intent = "general"
            code = f"""# Preview of the dataset
print(f"Dataset summary: {len(df)} rows, {len(df.columns)} columns")
print("\\nFirst 5 rows of data:")
print(df.head(5).to_string(index=False))
"""

        result = repl.execute(code, df)
        output_str = result.get("output", "")
        charts = [ChartInfo(**c) for c in result.get("charts", [])]
        
        answer_parts = []
        if intent == "chart":
            answer_parts.append("### 📊 Data Visualization & Aggregation")
            answer_parts.append(f"Here is the chart showing the relationship between `{cat}` and `{val}`.")
            if output_str:
                answer_parts.append("#### Aggregated Data Breakdown:")
                answer_parts.append("```\n" + output_str.strip() + "\n```")
        elif intent == "top":
            answer_parts.append("### 🏆 Top Performing Records")
            answer_parts.append(f"Here are the top performing records sorted by `{val}` in descending order:")
            if output_str:
                answer_parts.append("```\n" + output_str.strip() + "\n```")
        elif intent == "correlation":
            answer_parts.append("### 🔗 Variable Correlation Analysis")
            answer_parts.append("Computed the Pearson correlation coefficients for the numeric columns in the dataset:")
            if output_str:
                answer_parts.append("```\n" + output_str.strip() + "\n```")
        elif intent == "summary":
            answer_parts.append("### 📋 Dataset Summary Statistics")
            answer_parts.append("Computed general descriptive statistics for the numeric features:")
            if output_str:
                answer_parts.append("```\n" + output_str.strip() + "\n```")
        else:
            answer_parts.append("### 🔍 Dataset Preview Insights")
            answer_parts.append("Here is a preview of the dataset records:")
            if output_str:
                answer_parts.append("```\n" + output_str.strip() + "\n```")
                
        answer = "\n\n".join(answer_parts)
        elapsed_ms = int((time.time() - start_time) * 1000)
        
        return AnalysisResponse(
            session_id=session_id,
            status=AnalysisStatus.SUCCESS,
            question=question,
            answer=answer,
            code_executed=code,
            charts=charts,
            iterations=1,
            execution_time_ms=elapsed_ms,
        )
