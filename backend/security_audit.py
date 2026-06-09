""" run this security audit script for verifying that all the dangerous patterns are blocked"""

import sys
import os
sys.path.append(".")

import pandas as pd
from app.utils.sandbox import SandboxedREPL, SandboxViolationError

df = pd.DataFrame({
    "sales": [100, 200, 300],
    "region": ["North", "South", "East"]
})

repl = SandboxedREPL(
    charts_dir="static/charts",
    charts_base_url="http://localhost:8000/static/charts"
)

tests = [
    ("os.system block",     "os.system('whoami')"),
    ("subprocess block",    "import subprocess; subprocess.run(['ls'])"),
    ("open() block",        "open('test.txt', 'w')"),
    ("__import__ block",    "__import__('os').system('whoami')"),
    ("network block",       "import requests; requests.get('http://evil.com')"),
    ("infinite loop block", "while true:\n    pass"),
]

passed = 0
failed = 0

print("=" * 50)
print("StatBot Pro — Security Audit")
print("=" * 50)

for name, code in tests:
    try:
        result = repl.execute(code, df)
        if result["error"] is not None:
            print(f"BLOCKED — {name}")
            passed += 1
        else:
            print(f"NOT BLOCKED — {name} (VULNERABILITY!)")
            failed += 1
    except SandboxViolationError:
        print(f"BLOCKED — {name}")
        passed += 1
    except Exception as e:
        print(f"UNEXPECTED ERROR — {name}: {e}")
        failed += 1

# test normal pandas still works
result = repl.execute("print(df.describe())", df)
if result["error"] is None:
    print(" Normal pandas code still works correctly")
else:
    print(f"Normal pandas broken: {result['error']}")

print("=" * 50)