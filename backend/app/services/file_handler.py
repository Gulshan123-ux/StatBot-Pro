import pandas as pd


class FileHandler:

    @staticmethod
    def read_table(file, filename: str | None = None):
        suffix = (filename or "").lower()

        if suffix.endswith(".xlsx") or suffix.endswith(".xls"):
            return pd.read_excel(file)

        return pd.read_csv(file)

    @staticmethod
    def dataset_info(df):
        return {
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": list(df.columns)
        }
