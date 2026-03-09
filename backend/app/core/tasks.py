from typing import Callable, Any
from fastapi import BackgroundTasks
from app.core.config import settings
import asyncio

async def dispatch_task(
    func_name: str,
    *args: Any,
    background_tasks: BackgroundTasks = None,
    func_ref: Callable = None,
    **kwargs: Any
):
    """
    Dispatch a task either to ARQ (if Redis is configured) or FastAPI BackgroundTasks.
    Requires func_ref for the fallback memory task.
    """
    if settings.REDIS_URL:
        from arq import create_pool
        from arq.connections import RedisSettings
        
        # Simplified connection for pushing tasks
        redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
        await redis.enqueue_job(func_name, *args, **kwargs)
    else:
        if background_tasks and func_ref:
            background_tasks.add_task(func_ref, *args, **kwargs)
        else:
            # Synchronous fallback if no background_tasks provided
            if func_ref:
                if asyncio.iscoroutinefunction(func_ref):
                    await func_ref(*args, **kwargs)
                else:
                    func_ref(*args, **kwargs)
