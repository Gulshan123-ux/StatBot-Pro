import os
import re
import pandas as pd

def combine_codebase(root_dir, output_file="combined_codebase.txt"):
    """
    Combines all codebase source files into a single text file.
    """
    exclude_dirs = {
        'node_modules', '.next', 'split_output', '.git', 
        '__pycache__', 'venv', '.venv', 'dist', 'build', 'split_output'
    }
    exclude_files = {
        'package-lock.json', 'tsconfig.tsbuildinfo', '.DS_Store',
        'combined_codebase.txt', 'merged_data.csv', 'combine_helper.py'
    }
    allowed_extensions = {
        '.py', '.ts', '.tsx', '.js', '.jsx', '.css', '.json', 
        '.yml', '.yaml', '.html', '.md', '.env', '.local', 'Dockerfile'
    }

    print(f"Combining codebase files from: {root_dir}...")
    combined_content = []

    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Exclude directories in-place
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]

        for filename in filenames:
            if filename in exclude_files:
                continue

            filepath = os.path.join(dirpath, filename)
            ext = os.path.splitext(filename)[1].lower()
            
            # Check extension or special files like Dockerfile or .env
            is_allowed = ext in allowed_extensions or filename == 'Dockerfile' or filename.startswith('.env')
            
            if is_allowed:
                rel_path = os.path.relpath(filepath, root_dir)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    combined_content.append("=" * 80)
                    combined_content.append(f"FILE: {rel_path}")
                    combined_content.append("=" * 80)
                    combined_content.append(content)
                    combined_content.append("\n\n")
                    print(f"Added: {rel_path}")
                except Exception as e:
                    print(f"Failed to read {rel_path}: {e}")

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(combined_content))
    
    print(f"\nSuccessfully combined all codebase files into: {output_file}")


def merge_split_data(split_dir="statbotpro/split_output", output_file="merged_data.csv"):
    """
    Merges split parts (part_1.csv, part_2.csv, etc.) back into a single CSV.
    """
    if not os.path.exists(split_dir):
        print(f"Directory '{split_dir}' not found. Skipping data merging.")
        return

    print(f"Merging split data files from: {split_dir}...")
    all_files = []
    
    # Traverse split_output and collect all part files
    for dirpath, _, filenames in os.walk(split_dir):
        for filename in filenames:
            if filename.startswith("part_") and filename.endswith(".csv"):
                filepath = os.path.join(dirpath, filename)
                # Extract the part number to sort them in order
                match = re.search(r'part_(\d+)\.csv', filename)
                part_num = int(match.group(1)) if match else 9999
                all_files.append((part_num, filepath))

    if not all_files:
        print("No split CSV files found in the split output folder.")
        return

    # Sort files by their part number
    all_files.sort(key=lambda x: x[0])
    
    # Read and concatenate
    dfs = []
    for part_num, filepath in all_files:
        try:
            df = pd.read_csv(filepath)
            dfs.append(df)
            print(f"Loaded: {os.path.basename(filepath)} (Part {part_num})")
        except Exception as e:
            print(f"Error loading {filepath}: {e}")

    if dfs:
        merged_df = pd.concat(dfs, ignore_index=True)
        merged_df.to_csv(output_file, index=False)
        print(f"\nSuccessfully merged {len(all_files)} files into: {output_file}")
    else:
        print("No data was loaded successfully.")


if __name__ == "__main__":
    import sys
    # By default, run both to cover all bases
    root_dir = os.path.abspath(os.path.dirname(__file__))
    statbot_dir = os.path.join(root_dir, "statbotpro")
    
    print("--- 1. COMBINING CODEBASE ---")
    combine_codebase(statbot_dir, os.path.join(root_dir, "combined_codebase.txt"))
    
    print("\n--- 2. MERGING SPLIT DATA ---")
    merge_split_data(os.path.join(statbot_dir, "split_output"), os.path.join(root_dir, "merged_data.csv"))
