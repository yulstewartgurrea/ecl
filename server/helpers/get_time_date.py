from datetime import datetime

def get_time_date() -> str:
    """
    Get current timestamp in MMDDYYYY_HHMMSS format
    
    Returns:
        str: Current timestamp formatted as MMDDYYYY_HHMMSS
        Example: "12252024_143052" for December 25, 2024 at 2:30:52 PM
    """
    now = datetime.now()
    return now.strftime("%m%d%Y_%H%M%S")
