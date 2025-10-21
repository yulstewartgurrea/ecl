"""
Timestamp conversion utilities
"""
import datetime
from typing import Union


def timestamp_to_yyyy_mm_dd(timestamp: Union[int, float, str]) -> str:
    """
    Convert timestamp to YYYY-MM-DD format
    
    Args:
        timestamp: Unix timestamp in milliseconds or seconds
        
    Returns:
        str: Date in YYYY-MM-DD format
        
    Examples:
        >>> timestamp_to_yyyy_mm_dd(1756598400000)
        '2025-08-31'
        >>> timestamp_to_yyyy_mm_dd(1756598400)
        '2025-08-31'
    """
    try:
        # Convert to int if it's a string
        if isinstance(timestamp, str):
            timestamp = int(timestamp)
        
        # Determine if timestamp is in milliseconds or seconds
        # If timestamp is greater than year 2100 in seconds, it's likely milliseconds
        if timestamp > 4102444800:  # Year 2100 in seconds
            # Convert milliseconds to seconds
            timestamp = timestamp / 1000
        
        # Convert to datetime
        date = datetime.datetime.fromtimestamp(timestamp)
        
        # Format to YYYY-MM-DD
        return date.strftime('%Y-%m-%d')
        
    except (ValueError, TypeError, OSError) as e:
        raise ValueError(f"Invalid timestamp: {timestamp}. Error: {str(e)}")


def timestamp_to_datetime(timestamp: Union[int, float, str]) -> datetime.datetime:
    """
    Convert timestamp to datetime object
    
    Args:
        timestamp: Unix timestamp in milliseconds or seconds
        
    Returns:
        datetime.datetime: Datetime object
        
    Examples:
        >>> timestamp_to_datetime(1756598400000)
        datetime.datetime(2025, 8, 31, 0, 0)
    """
    try:
        # Convert to int if it's a string
        if isinstance(timestamp, str):
            timestamp = int(timestamp)
        
        # Determine if timestamp is in milliseconds or seconds
        if timestamp > 4102444800:  # Year 2100 in seconds
            # Convert milliseconds to seconds
            timestamp = timestamp / 1000
        
        # Convert to datetime
        return datetime.datetime.fromtimestamp(timestamp)
        
    except (ValueError, TypeError, OSError) as e:
        raise ValueError(f"Invalid timestamp: {timestamp}. Error: {str(e)}")


def datetime_to_timestamp(dt: datetime.datetime, milliseconds: bool = True) -> int:
    """
    Convert datetime to timestamp
    
    Args:
        dt: Datetime object
        milliseconds: If True, return milliseconds; if False, return seconds
        
    Returns:
        int: Unix timestamp
        
    Examples:
        >>> dt = datetime.datetime(2025, 8, 31, 0, 0)
        >>> datetime_to_timestamp(dt)
        1756598400000
    """
    timestamp = dt.timestamp()
    
    if milliseconds:
        return int(timestamp * 1000)
    else:
        return int(timestamp)
