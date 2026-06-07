"""
StatBot Pro — Autonomous CSV Analyst Agent Service.
Uses LangChain + GPT-4o with a sandboxed Python REPL tool.
Supports self-correction: retries on code errors up to MAX_ITERATIONS.

Note: updated to use langgraph ReAct agent (langchain >= 1.0)
"""

import os
import uuid
import time
import pandas as pd
from typing import Optional

#from langchain_openai import ChatOpenAI
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.tools import Tool
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from app.utils.sandbox import SandboxedREPL
from app.models.schemas import AnalysisResponse, AnalysisStatus, ChartInfo
from app.services.session_store import add_to_history, get_history  


SYSTEM_PROMPT = """You are StatBot Pro, an expert autonomous data analyst.
You have access to a pandas DataFrame called `df` loaded from a user-uploaded CSV file.

Your job:
1. Understand the user's analytical question.
2. Write clean, correct Python/pandas code to answer it.
3. Use the `execute_python` tool to run the code.
4. If the code produces an error, READ the error carefully, FIX the code, and try again.
5. ALWAYS generate a visualization using matplotlib/seaborn unless the question is purely numerical.
6. To save a chart call save_chart(title="Your Chart Title") — this saves the figure and returns the URL.
7. Always print() your final answer as a clean summary sentence.

DataFrame info:
{df_info}

IMPORTANT RULES:
- NEVER use os, subprocess, open(), or any file system operations.
- NEVER use requests, urllib, or network calls.
- Only use: pandas (pd), numpy (np), matplotlib (plt), seaborn (sns), save_chart().
- Always call plt.figure() before plotting.
- Always call save_chart(title="descriptive title") after every plot — never call plt.show().
- Print a clear summary sentence as your final answer.
- If data is missing or ambiguous, state your assumptions.

Example of correct chart code:
```python
import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
df.groupby('region')['sales'].sum().plot(kind='bar', color='steelblue')
plt.title('Total Sales by Region')
plt.xlabel('Region')
plt.ylabel('Sales')
plt.tight_layout()
save_chart(title='Total Sales by Region')
print("The total sales by region are shown in the chart above.")
```
"""

def _build_df_info(df: pd.DataFrame) -> str:
    info_lines = [
        f"Shape: {df.shape[0]} rows x {df.shape[1]} columns",
        f"Columns: {list(df.columns)}",
        "Dtypes:",
    ]
    for col, dtype in df.dtypes.items():
        nulls = df[col].isna().sum()
        info_lines.append(f"  - {col}: {dtype} ({nulls} nulls)")
    info_lines.append("\nFirst 3 rows:")
    info_lines.append(df.head(3).to_string())
    return "\n".join(info_lines)


class CSVAnalystAgent:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.llm_provider = os.getenv("LLM_PROVIDER", "groq")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")
        self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self.max_iterations = int(os.getenv("MAX_ITERATIONS", "10"))
        self.charts_dir = os.getenv("CHARTS_DIR", "static/charts")
        self.charts_base_url = os.getenv(
        "CHARTS_BASE_URL", "http://localhost:8000/static/charts"
        )

    def _make_repl_tool(self, df: pd.DataFrame, repl: SandboxedREPL):
        """Create a LangChain Tool wrapping the sandboxed REPL."""
        results_store = {"charts": [], "last_output": "", "code_snippets": []}

        def run_code(code: str) -> str:
            results_store["code_snippets"].append(code)
            result = repl.execute(code, df)
            results_store["charts"].extend(result.get("charts", []))

            if result["error"]:
                return f"ERROR:\n{result['error']}"

            output = result["output"] or "(Code ran successfully, no printed output)"
            results_store["last_output"] = output

            chart_notes = ""
            if result["charts"]:
                urls = [c["url"] for c in result["charts"]]
                chart_notes = f"\n\nCharts saved: {urls}"

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

        if not self.groq_api_key and not self.openai_api_key:
            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.ERROR,
                question=question,
                error="No API key configured. Add GROQ_API_KEY or OPENAI_API_KEY to backend/.env",
            )

        repl = SandboxedREPL(self.charts_dir, self.charts_base_url)
        tool, results_store = self._make_repl_tool(df, repl)

        df_info = _build_df_info(df)
        system_msg = SYSTEM_PROMPT.format(df_info=df_info)

        # use Groq by default - free and fast
        # set LLM_PROVIDER=openai in .env to switch back
        if self.llm_provider == "groq" and self.groq_api_key:
            llm = ChatGroq(
                model=self.groq_model,
                temperature=0,
                api_key=self.groq_api_key,
            )
        else:
            llm = ChatOpenAI(
                model=self.model,
                temperature=0,
                api_key=self.openai_api_key,
            )

        # langgraph ReAct agent - works with langchain >= 1.0
        agent = create_react_agent(
            model=llm,
            tools=[tool],
        )

        try:
            # build messages with conversation history
            messages = [SystemMessage(content=system_msg)]

            # inject previous exchanges so agent remembers context
            history = get_history(session_id)

            for exchange in history:
                messages.append(HumanMessage(content=exchange["question"]))
                messages.append(SystemMessage(content=f"Previous answer: {exchange['answer']}"))

            messages.append(HumanMessage(content=question))

            result = await agent.ainvoke(
                {"messages": messages},
                config={"recursion_limit": self.max_iterations * 3},
            )

            # extract final answer from last AI message
            answer = ""
            for msg in reversed(result["messages"]):
                if hasattr(msg, "content") and msg.content and not hasattr(msg, "tool_calls"):
                    answer = msg.content
                    break

            if not answer:
                answer = results_store["last_output"] or "Analysis complete."

            charts = [ChartInfo(**c) for c in results_store["charts"]]
            elapsed_ms = int((time.time() - start_time) * 1000)
            iterations = len(results_store["code_snippets"])

            # save to session history for follow-up questions
            # save to session history for follow-up questions
            add_to_history(session_id, question, answer)

            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.SUCCESS,
                question=question,
                answer=answer,
                charts=charts,
                code_executed="\n\n# --- next iteration ---\n\n".join(
                    results_store["code_snippets"]
                ),
                iterations=iterations,
                execution_time_ms=elapsed_ms,
            )

        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.ERROR,
                question=question,
                error=str(e),
                execution_time_ms=elapsed_ms,
            )