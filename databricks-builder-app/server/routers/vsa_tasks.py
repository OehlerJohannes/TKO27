"""VSA Tasks router — task queue management and draft reply editing."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..db import session_scope
from ..db.models import VsaCustomer, VsaOrder, VsaProduct, VsaTask
from ..services.vsa_agent import (
  draft_customer_issue_reply,
  draft_general_inquiry_reply,
  draft_missing_info_reply,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class TaskPatch(BaseModel):
  """Task update payload."""

  status: str | None = None
  draft_reply: str | None = None
  notes: str | None = None
  problem_summary: str | None = None
  solution_summary: str | None = None


_VALID_STATUSES = {'open', 'in_progress', 'resolved'}
_TASK_OPTIONS = [
  selectinload(VsaTask.email),
  selectinload(VsaTask.customer),
  selectinload(VsaTask.product),
  selectinload(VsaTask.order).selectinload(VsaOrder.customer),
  selectinload(VsaTask.order).selectinload(VsaOrder.product),
]


@router.get('/vsa/tasks')
async def list_tasks(status: str | None = None, task_type: str | None = None):
  """List tasks with optional filters."""
  async with session_scope() as session:
    query = select(VsaTask).options(*_TASK_OPTIONS).order_by(VsaTask.created_at.desc())
    if status:
      query = query.where(VsaTask.status == status)
    if task_type:
      query = query.where(VsaTask.task_type == task_type)
    result = await session.execute(query)
    tasks = result.scalars().all()
    return [t.to_dict() for t in tasks]


@router.get('/vsa/tasks/stats')
async def get_task_stats():
  """Return task counts grouped by status and type."""
  from sqlalchemy import func

  async with session_scope() as session:
    result = await session.execute(
      select(VsaTask.status, VsaTask.task_type, func.count().label('count'))
      .group_by(VsaTask.status, VsaTask.task_type)
    )
    rows = result.all()
    stats: dict = {
      'by_status': {'open': 0, 'in_progress': 0, 'resolved': 0},
      'by_type': {'new_order': 0, 'customer_issue': 0, 'general_inquiry': 0},
      'total': 0,
    }
    for status, task_type, count in rows:
      stats['by_status'][status] = stats['by_status'].get(status, 0) + count
      stats['by_type'][task_type] = stats['by_type'].get(task_type, 0) + count
      stats['total'] += count
    return stats


@router.get('/vsa/tasks/{task_id}')
async def get_task(task_id: str):
  """Get a single task with full details."""
  async with session_scope() as session:
    task = await session.get(VsaTask, task_id, options=_TASK_OPTIONS)
    if not task:
      raise HTTPException(status_code=404, detail='Task not found')
    return task.to_dict()


@router.patch('/vsa/tasks/{task_id}')
async def update_task(task_id: str, body: TaskPatch):
  """Update task fields (draft reply, status, notes, summaries)."""
  async with session_scope() as session:
    task = await session.get(VsaTask, task_id, options=_TASK_OPTIONS)
    if not task:
      raise HTTPException(status_code=404, detail='Task not found')

    if body.status is not None:
      if body.status not in _VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f'Invalid status. Must be one of: {_VALID_STATUSES}')
      task.status = body.status

    if body.draft_reply is not None:
      task.draft_reply = body.draft_reply
    if body.notes is not None:
      task.notes = body.notes
    if body.problem_summary is not None:
      task.problem_summary = body.problem_summary
    if body.solution_summary is not None:
      task.solution_summary = body.solution_summary

    await session.flush()
    # Re-query with eager loading (refresh() would expire relationships)
    task_result = await session.execute(
      select(VsaTask).where(VsaTask.id == task_id).options(*_TASK_OPTIONS)
    )
    return task_result.scalar_one().to_dict()


@router.post('/vsa/tasks/{task_id}/regenerate-reply')
async def regenerate_reply(task_id: str):
  """Re-run the LLM to regenerate the draft reply for a task."""
  async with session_scope() as session:
    task = await session.get(VsaTask, task_id, options=_TASK_OPTIONS)
    if not task:
      raise HTTPException(status_code=404, detail='Task not found')

    products_result = await session.execute(select(VsaProduct).order_by(VsaProduct.name))
    products_list = [p.to_dict() for p in products_result.scalars().all()]

    email = task.email
    if not email:
      raise HTTPException(status_code=422, detail='Task has no associated email')

    if task.task_type == 'customer_issue':
      result = draft_customer_issue_reply(email.subject, email.body, products_list)
      task.problem_summary = result['problem_summary']
      task.solution_summary = result['solution_summary']
      task.draft_reply = result['draft_reply']

    elif task.task_type == 'general_inquiry':
      task.draft_reply = draft_general_inquiry_reply(email.subject, email.body, products_list)

    else:  # new_order
      customer = task.customer
      if customer:
        missing = [f for f, v in [('delivery address', customer.address), ('phone number', customer.phone)] if not v]
        if missing:
          task.draft_reply = draft_missing_info_reply(email.subject, email.body, missing)
        else:
          task.draft_reply = (
            f'Dear {customer.name},\n\nThank you for your order! '
            'We are processing it now.\n\nBest regards,\nThe Spice Mix Team'
          )
      else:
        task.draft_reply = draft_missing_info_reply(
          email.subject, email.body, ['full name', 'delivery address', 'phone number']
        )

    await session.flush()
    # Re-query with eager loading (refresh() would expire relationships)
    task_result = await session.execute(
      select(VsaTask).where(VsaTask.id == task_id).options(*_TASK_OPTIONS)
    )
    logger.info('Regenerated reply for task %s', task_id)
    return task_result.scalar_one().to_dict()
