"""
Shared thread pool for optimisation jobs.

Both /run and /run/csv submit background jobs here so the worker budget is
capped globally (max 2 concurrent), rather than each route owning its own pool
and competing for CPU on a small instance.
"""

from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=2)
