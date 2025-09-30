import os
import pandas as pd
from fastapi import HTTPException
from typing import Optional, List


def find_file_with_extensions(root_folder: str, subfolder_path: str, filename_base: str, extensions: List[str] = None) -> Optional[str]:
    """
    Find a file with multiple possible extensions in a directory structure.
    
    Args:
        root_folder: Root directory path
        subfolder_path: Subfolder path within root (e.g., "data/ecl/development")
        filename_base: Base filename without extension (e.g., "data_interpolation_monthly")
        extensions: List of file extensions to try (default: ['.csv', '.xlsx', '.xls'])
    
    Returns:
        Full file path if found, None otherwise
    """
    if extensions is None:
        extensions = ['.csv', '.xlsx', '.xls']
    
    for ext in extensions:
        potential_path = os.path.join(root_folder, subfolder_path, f"{filename_base}{ext}")
        if os.path.exists(potential_path):
            return potential_path
    
    return None


def read_data_file(file_path: str) -> pd.DataFrame:
    """
    Read a data file (CSV or Excel) and return a pandas DataFrame.
    
    Args:
        file_path: Full path to the file
    
    Returns:
        pandas DataFrame
    
    Raises:
        HTTPException: If file format is unsupported or file cannot be read
    """
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    
    file_ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if file_ext == '.csv':
            df = pd.read_csv(file_path)
        elif file_ext == '.xlsx':
            df = pd.read_excel(file_path, engine="openpyxl")
        elif file_ext == '.xls':
            df = pd.read_excel(file_path, engine="xlrd")
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {file_ext}")
        
        return df
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="File is empty")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


def find_and_read_data_file(root_folder: str, subfolder_path: str, filename_base: str, extensions: List[str] = None) -> pd.DataFrame:
    """
    Convenience function that combines finding and reading a data file.
    
    Args:
        root_folder: Root directory path
        subfolder_path: Subfolder path within root
        filename_base: Base filename without extension
        extensions: List of file extensions to try
    
    Returns:
        pandas DataFrame
    
    Raises:
        HTTPException: If file not found or cannot be read
    """
    file_path = find_file_with_extensions(root_folder, subfolder_path, filename_base, extensions)
    
    if not file_path:
        if extensions is None:
            extensions = ['.csv', '.xlsx', '.xls']
        raise HTTPException(
            status_code=404, 
            detail=f"Data file not found for: {filename_base}. Tried extensions: {extensions}"
        )
    
    return read_data_file(file_path)


def get_root_folder() -> str:
    """
    Get the project root folder by traversing up from the current file location.
    
    Returns:
        Root folder path
    """
    # Go up from server/helpers/file_utils.py to project root
    # server/helpers/file_utils.py -> server/helpers -> server -> project_root
    current_dir = os.path.dirname(__file__)  # server/helpers/
    server_dir = os.path.dirname(current_dir)  # server/
    root_dir = os.path.dirname(server_dir)  # project_root/
    return root_dir
