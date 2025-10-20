import os

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

    return server_dir