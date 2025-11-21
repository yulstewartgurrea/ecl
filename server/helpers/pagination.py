from typing import List, Dict, Any, Optional, Union
from math import ceil


def paginate_data(
    data: List[Any], 
    page: int = 1, 
    page_size: int = 100,
    total_count: Optional[int] = None
) -> Dict[str, Any]:
    """
    Paginate a list of data with metadata
    
    Args:
        data: List of items to paginate
        page: Current page number (1-indexed)
        page_size: Number of items per page
        total_count: Total count of items (if None, uses len(data))
    
    Returns:
        Dict containing paginated data and metadata
        
    Example:
        >>> items = list(range(1, 26))  # 25 items
        >>> result = paginate_data(items, page=2, page_size=10)
        >>> print(result['pagination'])
        {
            'current_page': 2,
            'page_size': 10,
            'total_items': 25,
            'total_pages': 3,
            'has_next': True,
            'has_previous': True,
            'next_page': 3,
            'previous_page': 1
        }
    """
    if total_count is None:
        total_count = len(data)
    
    # Validate inputs
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 10
    
    # Calculate pagination metadata
    total_pages = ceil(total_count / page_size) if total_count > 0 else 0
    
    # Ensure page doesn't exceed total pages
    if page > total_pages and total_pages > 0:
        page = total_pages
    
    # Calculate offset for slicing
    offset = (page - 1) * page_size
    
    # Slice the data for current page
    paginated_data = data[offset:offset + page_size]
    
    # Build pagination metadata
    pagination_info = {
        'current_page': page,
        'page_size': page_size,
        'total_items': total_count,
        'total_pages': total_pages,
        'has_next': page < total_pages,
        'has_previous': page > 1,
        'next_page': page + 1 if page < total_pages else None,
        'previous_page': page - 1 if page > 1 else None,
        'start_index': offset + 1 if total_count > 0 else 0,
        'end_index': min(offset + page_size, total_count)
    }
    
    return {
        'data': paginated_data,
        'pagination': pagination_info
    }


def paginate_query_result(
    query_result: List[Any],
    page: int = 1,
    page_size: int = 10,
    total_count: Optional[int] = None
) -> Dict[str, Any]:
    """
    Paginate SQLAlchemy query results with metadata
    
    Args:
        query_result: List of SQLAlchemy model instances
        page: Current page number (1-indexed)
        page_size: Number of items per page
        total_count: Total count from database query
    
    Returns:
        Dict containing paginated data and metadata
    """
    return paginate_data(query_result, page, page_size, total_count)


def create_pagination_response(
    data: List[Any],
    page: int = 1,
    page_size: int = 10,
    total_count: Optional[int] = None,
    success: bool = True,
    message: str = "Success"
) -> Dict[str, Any]:
    """
    Create a standardized API response with pagination
    
    Args:
        data: List of items to paginate
        page: Current page number (1-indexed)
        page_size: Number of items per page
        total_count: Total count of items
        success: Whether the operation was successful
        message: Response message
    
    Returns:
        Dict containing standardized API response with pagination
        
    Example:
        >>> items = [{'id': 1, 'name': 'Item 1'}, {'id': 2, 'name': 'Item 2'}]
        >>> response = create_pagination_response(items, page=1, page_size=10)
        >>> print(response)
        {
            'code': 1,
            'success': True,
            'msg': 'Success',
            'data': [{'id': 1, 'name': 'Item 1'}, {'id': 2, 'name': 'Item 2'}],
            'pagination': {
                'current_page': 1,
                'page_size': 10,
                'total_items': 2,
                'total_pages': 1,
                'has_next': False,
                'has_previous': False,
                'next_page': None,
                'previous_page': None,
                'start_index': 1,
                'end_index': 2
            }
        }
    """
    paginated_result = paginate_data(data, page, page_size, total_count)
    
    return {
        'code': 1 if success else -1,
        'success': success,
        'msg': message,
        'data': paginated_result['data'],
        'pagination': paginated_result['pagination']
    }


def validate_pagination_params(page: int, page_size: int, max_page_size: int = 100) -> tuple[int, int]:
    """
    Validate and sanitize pagination parameters
    
    Args:
        page: Current page number
        page_size: Items per page
        max_page_size: Maximum allowed page size
    
    Returns:
        Tuple of validated (page, page_size)
    """
    # Ensure page is at least 1
    if page < 1:
        page = 1
    
    # Ensure page_size is within bounds
    if page_size < 1:
        page_size = 10
    elif page_size > max_page_size:
        page_size = max_page_size
    
    return page, page_size


def get_pagination_links(
    current_page: int,
    total_pages: int,
    base_url: str,
    page_param: str = "page",
    page_size_param: str = "page_size",
    current_page_size: int = 10
) -> Dict[str, Optional[str]]:
    """
    Generate pagination links for API responses
    
    Args:
        current_page: Current page number
        total_pages: Total number of pages
        base_url: Base URL for the API endpoint
        page_param: Query parameter name for page
        page_size_param: Query parameter name for page size
        current_page_size: Current page size
    
    Returns:
        Dict containing pagination links
    """
    def build_url(page: Optional[int]) -> Optional[str]:
        if page is None:
            return None
        separator = "&" if "?" in base_url else "?"
        return f"{base_url}{separator}{page_param}={page}&{page_size_param}={current_page_size}"
    
    return {
        'first': build_url(1) if total_pages > 0 else None,
        'last': build_url(total_pages) if total_pages > 0 else None,
        'next': build_url(current_page + 1) if current_page < total_pages else None,
        'previous': build_url(current_page - 1) if current_page > 1 else None,
        'current': build_url(current_page)
    }
