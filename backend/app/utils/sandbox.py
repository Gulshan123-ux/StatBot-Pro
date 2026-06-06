"""
Sandboxed Python REPL Tool for StatBot Pro.
Executes pandas/matplotlib code in a restricted environment.
"""

import contextlib
import io
import os
import traceback
import uuid
from datetime import datetime
from typing import Optional


BLOCKED_BUILTINS = {
    "__import__",
    "eval",
    "exec",
    "compile",
    "open",
    "input",
    "breakpoint",
}

BLOCKED_MODULES = {
    "os",
    "sys",
    "subprocess",
    "shutil",
    "pathlib",
    "socket",
    "urllib",
    "http",
    "requests",
    "ftplib",
    "smtplib",
    "pickle",
    "shelve",
    "ctypes",
    "multiprocessing",
    "threading",
    "importlib",
    "glob",
}


class SandboxViolationError(Exception):
    pass


class _MissingLibrary:
    def __init__(self, library_name: str):
        self.library_name = library_name

    def __getattr__(self, name):
        raise RuntimeError(
            f"{self.library_name} is not installed in the backend environment."
        )


def _create_safe_globals(df, charts_dir: str, charts_base_url: str) -> dict:
    """
    Build a restricted globals dict that exposes only safe libraries.
    """
    import numpy as np
    import pandas as pd

    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        plt = _MissingLibrary("matplotlib")

    try:
        import seaborn as sns
    except ImportError:
        sns = _MissingLibrary("seaborn")

    generated_charts = []

    def safe_savefig(title: Optional[str] = None):
        if isinstance(plt, _MissingLibrary):
            raise RuntimeError("matplotlib is required to generate charts.")

        filename = (
            f"chart_{uuid.uuid4().hex[:8]}_"
            f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        )
        filepath = os.path.join(charts_dir, filename)
        plt.tight_layout()
        plt.savefig(filepath, dpi=150, bbox_inches="tight", facecolor="white")
        plt.close("all")
        url = f"{charts_base_url}/{filename}"
        generated_charts.append(
            {
                "filename": filename,
                "url": url,
                "title": title or "Chart",
            }
        )
        return url

    builtins_source = (
        __builtins__.items()  # type: ignore[attr-defined]
        if isinstance(__builtins__, dict)
        else ((name, getattr(__builtins__, name)) for name in dir(__builtins__))
    )

    safe_globals = {
        "__builtins__": {
            name: value
            for name, value in builtins_source
            if name not in BLOCKED_BUILTINS
        },
        "pd": pd,
        "np": np,
        "plt": plt,
        "sns": sns,
        "df": df,
        "save_chart": safe_savefig,
        "_generated_charts": generated_charts,
        "print": print,
    }

    return safe_globals


class SandboxedREPL:
    """
    Executes Python/Pandas code safely in a sandboxed namespace.
    Blocks OS, subprocess, and file system access.
    """

    def __init__(self, charts_dir: str, charts_base_url: str):
        self.charts_dir = charts_dir
        self.charts_base_url = charts_base_url
        os.makedirs(charts_dir, exist_ok=True)

    def execute(self, code: str, df) -> dict:
        """
        Execute code against the dataframe.
        Returns: { output, charts, error }
        """
        stdout_capture = io.StringIO()
        error = None
        output = ""
        charts = []

        try:
            self._static_check(code)
            safe_globals = _create_safe_globals(
                df,
                self.charts_dir,
                self.charts_base_url,
            )

            with contextlib.redirect_stdout(stdout_capture):
                exec(compile(code, "<sandbox>", "exec"), safe_globals)  # noqa: S102

            output = stdout_capture.getvalue()
            charts = safe_globals.get("_generated_charts", [])
        except SandboxViolationError as exc:
            error = f"Sandbox violation: {exc}"
        except Exception:
            error = traceback.format_exc()

        return {
            "output": output,
            "charts": charts,
            "error": error,
        }

    def _static_check(self, code: str):
        """Raise if code contains obviously dangerous patterns."""
        lower = code.lower()
        dangerous_patterns = [
            "os.system",
            "os.popen",
            "subprocess",
            "shutil.rmtree",
            "__import__",
            "open(",
            "socket.",
            "requests.",
            "urllib.",
        ]

        for pattern in dangerous_patterns:
            if pattern in lower:
                raise SandboxViolationError(
                    f"Pattern '{pattern}' is not allowed in the sandbox."
                )
