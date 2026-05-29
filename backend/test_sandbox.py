"""
Manual test script - run this to verify sandbox is blocking dangerous code.
Usage: python test_sandbox.py
"""

import os
import sys

import pandas as pd

sys.path.append(".")

from app.utils.sandbox import SandboxedREPL, SandboxViolationError

# Sample dataframe for testing
df = pd.DataFrame({
    "sales": [100, 200, 150, 300, 250],
    "region": ["North", "South", "East", "West", "North"],
    "month": ["Jan", "Feb", "Mar", "Apr", "May"]
})

repl = SandboxedREPL(
    charts_dir="static/charts",
    charts_base_url="http://localhost:8000/static/charts"
)

print("Running sandbox tests...\n")

# Test 1 - Basic pandas should work fine
result = repl.execute("print(df.describe())", df)
assert result["error"] is None, f"Test 1 failed: {result['error']}"
print(" Test 1 passed - Basic pandas works")

# Test 2 - os.system should be blocked
result = repl.execute("os.system('whoami')", df)
assert result["error"] is not None, "Test 2 failed - should have been blocked"
print(" Test 2 passed - os.system blocked")

# Test 3 - subprocess should be blocked
result = repl.execute("import subprocess; subprocess.run(['ls'])", df)
assert result["error"] is not None, "Test 3 failed - should have been blocked"
print(" Test 3 passed - subprocess blocked")

# Test 4 - open() should be blocked
result = repl.execute("open('test.txt', 'w')", df)
assert result["error"] is not None, "Test 4 failed - should have been blocked"
print(" Test 4 passed - open() blocked")

# Test 5 - Groupby aggregation should work
result = repl.execute("print(df.groupby('region')['sales'].sum())", df)
assert result["error"] is None, f"Test 5 failed: {result['error']}"
print(" Test 5 passed - Groupby works")

print("\nAll tests passed ✅")