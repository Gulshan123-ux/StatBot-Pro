"""
StatBot Pro agent service.

This implementation uses the OpenAI Python SDK directly and iterates on
model-generated Python code inside the local sandbox until it succeeds or
reaches the retry limit.
"""

from __future__ import annotations

import os
import re
import time
import uuid
from typing import Optional

import pandas as pd
from openai import AsyncOpenAI

from app.models.schemas import AnalysisResponse, AnalysisStatus, ChartInfo
from app.utils.sandbox import SandboxedREPL


SYSTEM_PROMPT = """You are StatBot Pro, an expert data analyst working on a pandas DataFrame named `df`.

Your task is to write Python code that answers the user's question using the provided DataFrame.

Rules:
- Return ONLY one fenced ```python``` code block and no extra prose.
- Do not import anything.
- Use only the already available objects: `df`, `pd`, `np`, `plt`, `sns`, `save_chart`.
- Never use file I/O, shell access, subprocesses, networking, or OS utilities.
- Always print a concise final answer for the user.
- If a chart is useful, create it with matplotlib/seaborn and call `save_chart(title="...")`.
- Keep the full script self-contained on each retry.
"""


def _build_df_info(df: pd.DataFrame) -> str:
    preview = df.head(5).to_string(index=False)
    lines = [
        f"Shape: {df.shape[0]} rows x {df.shape[1]} columns",
        f"Columns: {list(df.columns)}",
        "Dtypes and null counts:",
    ]

    for column, dtype in df.dtypes.items():
        lines.append(f"- {column}: {dtype} ({int(df[column].isna().sum())} nulls)")

    lines.extend(["", "First 5 rows:", preview])
    return "\n".join(lines)


def _extract_python_code(content: str) -> str:
    match = re.search(r"```python\s*(.*?)```", content, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip()

    match = re.search(r"```\s*(.*?)```", content, re.DOTALL)
    if match:
        return match.group(1).strip()

    return content.strip()


class CSVAnalystAgent:
    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")
        self.max_iterations = int(os.getenv("MAX_ITERATIONS", "5"))
        self.charts_dir = os.getenv("CHARTS_DIR", "static/charts")
        self.charts_base_url = os.getenv(
            "CHARTS_BASE_URL",
            "http://localhost:8000/static/charts",
        )

    async def _generate_code(
        self,
        client: AsyncOpenAI,
        *,
        question: str,
        df_info: str,
        previous_code: Optional[str] = None,
        previous_error: Optional[str] = None,
    ) -> str:
        user_prompt = [
            f"User question:\n{question}",
            "",
            f"DataFrame context:\n{df_info}",
        ]

        if previous_code and previous_error:
            user_prompt.extend(
                [
                    "",
                    "The previous attempt failed.",
                    f"Previous code:\n{previous_code}",
                    "",
                    f"Error:\n{previous_error}",
                    "",
                    "Return a corrected full Python script only.",
                ]
            )
        else:
            user_prompt.extend(["", "Write the full Python script now."])

        response = await client.chat.completions.create(
            model=self.model,
            temperature=0,
            max_completion_tokens=1600,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "\n".join(user_prompt)},
            ],
        )

        message = response.choices[0].message.content or ""
        return _extract_python_code(message)

    async def analyze(
        self,
        df: pd.DataFrame,
        question: str,
        session_id: Optional[str] = None,
    ) -> AnalysisResponse:
        session_id = session_id or uuid.uuid4().hex
        started_at = time.time()

        if not self.openai_api_key:
            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.ERROR,
                question=question,
                error="OPENAI_API_KEY is not configured for the backend.",
                rows=len(df),
                columns=len(df.columns),
            )

        client = AsyncOpenAI(api_key=self.openai_api_key)
        repl = SandboxedREPL(self.charts_dir, self.charts_base_url)
        df_info = _build_df_info(df)

        previous_code: Optional[str] = None
        previous_error: Optional[str] = None
        executed_scripts: list[str] = []

        for iteration in range(1, self.max_iterations + 1):
            try:
                code = await self._generate_code(
                    client,
                    question=question,
                    df_info=df_info,
                    previous_code=previous_code,
                    previous_error=previous_error,
                )
            except Exception as exc:
                elapsed_ms = int((time.time() - started_at) * 1000)
                return AnalysisResponse(
                    session_id=session_id,
                    status=AnalysisStatus.ERROR,
                    question=question,
                    error=f"Model request failed: {exc}",
                    iterations=iteration - 1,
                    execution_time_ms=elapsed_ms,
                    rows=len(df),
                    columns=len(df.columns),
                    code_executed="\n\n# --- next iteration ---\n\n".join(
                        executed_scripts
                    )
                    or None,
                )

            if not code:
                previous_code = None
                previous_error = "The model returned an empty response."
                continue

            executed_scripts.append(code)
            result = repl.execute(code, df)

            if result["error"]:
                previous_code = code
                previous_error = result["error"]
                continue

            output = (result["output"] or "").strip()
            charts = [ChartInfo(**chart) for chart in result["charts"]]
            elapsed_ms = int((time.time() - started_at) * 1000)

            if not output and charts:
                output = "Analysis completed successfully and generated chart output."
            elif not output:
                output = "Analysis completed successfully."

            return AnalysisResponse(
                session_id=session_id,
                status=AnalysisStatus.SUCCESS,
                question=question,
                answer=output,
                charts=charts,
                iterations=iteration,
                code_executed="\n\n# --- next iteration ---\n\n".join(
                    executed_scripts
                ),
                execution_time_ms=elapsed_ms,
                rows=len(df),
                columns=len(df.columns),
            )

        elapsed_ms = int((time.time() - started_at) * 1000)
        return AnalysisResponse(
            session_id=session_id,
            status=AnalysisStatus.ERROR,
            question=question,
            error=previous_error or "The agent could not produce valid analysis code.",
            iterations=self.max_iterations,
            code_executed="\n\n# --- next iteration ---\n\n".join(executed_scripts)
            or None,
            execution_time_ms=elapsed_ms,
            rows=len(df),
            columns=len(df.columns),
        )
