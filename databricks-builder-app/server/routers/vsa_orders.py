"""VSA Orders router — create and manage confirmed orders."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..db import session_scope
from ..db.models import VsaCustomer, VsaOrder, VsaProduct, VsaTask

logger = logging.getLogger(__name__)
router = APIRouter()


class OrderIn(BaseModel):
  task_id: str
  quantity: int = 1
  delivery_address: str | None = None
  notes: str | None = None


class OrderStatusIn(BaseModel):
  status: str  # pending / confirmed / shipped / delivered


@router.get('/vsa/orders')
async def list_orders():
  """List all orders ordered by newest first."""
  async with session_scope() as session:
    result = await session.execute(
      select(VsaOrder)
      .options(selectinload(VsaOrder.customer), selectinload(VsaOrder.product))
      .order_by(VsaOrder.created_at.desc())
    )
    return [o.to_dict() for o in result.scalars().all()]


@router.post('/vsa/orders', status_code=201)
async def create_order(body: OrderIn):
  """Create an order from a new_order task.

  Also advances the task status to in_progress and deducts stock.
  """
  async with session_scope() as session:
    # Load task with relationships
    task = await session.get(
      VsaTask, body.task_id,
      options=[
        selectinload(VsaTask.customer),
        selectinload(VsaTask.product),
        selectinload(VsaTask.order),
      ],
    )
    if not task:
      raise HTTPException(status_code=404, detail='Task not found')
    if task.task_type != 'new_order':
      raise HTTPException(status_code=400, detail='Only new_order tasks can have orders')
    if task.order:
      raise HTTPException(status_code=409, detail='Order already exists for this task')
    if not task.customer_id:
      raise HTTPException(status_code=400, detail='Task has no linked customer')

    # Compute prices from product if available
    unit_price = None
    total_price = None
    if task.product and task.product.price is not None:
      unit_price = float(task.product.price)
      total_price = unit_price * body.quantity

    # Use customer address as fallback for delivery address
    delivery_address = body.delivery_address
    if not delivery_address and task.customer:
      delivery_address = task.customer.address

    order = VsaOrder(
      task_id=body.task_id,
      customer_id=task.customer_id,
      product_id=task.product_id,
      quantity=body.quantity,
      unit_price=unit_price,
      total_price=total_price,
      delivery_address=delivery_address,
      notes=body.notes,
      status='pending',
    )
    session.add(order)

    # Advance task to in_progress
    task.status = 'in_progress'

    # Deduct stock if product linked
    if task.product_id:
      product = await session.get(VsaProduct, task.product_id)
      if product and product.stock > 0:
        product.stock = max(0, product.stock - body.quantity)

    await session.flush()
    order_reloaded = await session.get(
      VsaOrder, order.id,
      options=[selectinload(VsaOrder.customer), selectinload(VsaOrder.product)],
    )
    logger.info('Created order %s for task %s', order.id, body.task_id)
    return order_reloaded.to_dict()


@router.patch('/vsa/orders/{order_id}')
async def update_order_status(order_id: str, body: OrderStatusIn):
  """Update order status (pending → confirmed → shipped → delivered)."""
  valid = {'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'}
  if body.status not in valid:
    raise HTTPException(status_code=400, detail=f'Invalid status. Must be one of: {", ".join(valid)}')
  async with session_scope() as session:
    order = await session.get(
      VsaOrder, order_id,
      options=[selectinload(VsaOrder.customer), selectinload(VsaOrder.product)],
    )
    if not order:
      raise HTTPException(status_code=404, detail='Order not found')
    order.status = body.status

    # Sync task status when order is delivered or cancelled
    if body.status == 'delivered':
      task = await session.get(VsaTask, order.task_id)
      if task:
        task.status = 'resolved'
    await session.flush()
    order_result = await session.execute(
      select(VsaOrder).where(VsaOrder.id == order_id)
      .options(selectinload(VsaOrder.customer), selectinload(VsaOrder.product))
    )
    return order_result.scalar_one().to_dict()
