"""VSA Customers router — customer directory CRUD."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from ..db import session_scope
from ..db.models import VsaCustomer

logger = logging.getLogger(__name__)
router = APIRouter()


class CustomerIn(BaseModel):
  """Customer create/update payload."""

  name: str
  email: str
  phone: str | None = None
  address: str | None = None
  company: str | None = None


@router.get('/vsa/customers')
async def list_customers():
  """List all customers."""
  async with session_scope() as session:
    result = await session.execute(select(VsaCustomer).order_by(VsaCustomer.name))
    customers = result.scalars().all()
    return [c.to_dict() for c in customers]


@router.get('/vsa/customers/lookup')
async def lookup_customer(email: str):
  """Look up a customer by email address."""
  async with session_scope() as session:
    result = await session.execute(
      select(VsaCustomer).where(VsaCustomer.email == email.lower().strip())
    )
    customer = result.scalar_one_or_none()
    if not customer:
      return {'found': False, 'customer': None}
    return {'found': True, 'customer': customer.to_dict()}


@router.post('/vsa/customers', status_code=201)
async def create_customer(body: CustomerIn):
  """Create a new customer."""
  async with session_scope() as session:
    customer = VsaCustomer(
      name=body.name,
      email=body.email.lower().strip(),
      phone=body.phone,
      address=body.address,
      company=body.company,
    )
    session.add(customer)
    await session.flush()
    await session.refresh(customer)
    logger.info('Created customer %s', customer.id)
    return customer.to_dict()


@router.patch('/vsa/customers/{customer_id}')
async def update_customer(customer_id: str, body: CustomerIn):
  """Update a customer."""
  async with session_scope() as session:
    customer = await session.get(VsaCustomer, customer_id)
    if not customer:
      raise HTTPException(status_code=404, detail='Customer not found')
    customer.name = body.name
    customer.email = body.email.lower().strip()
    customer.phone = body.phone
    customer.address = body.address
    customer.company = body.company
    await session.flush()
    await session.refresh(customer)
    return customer.to_dict()


@router.delete('/vsa/customers/{customer_id}', status_code=204)
async def delete_customer(customer_id: str):
  """Delete a customer."""
  async with session_scope() as session:
    customer = await session.get(VsaCustomer, customer_id)
    if not customer:
      raise HTTPException(status_code=404, detail='Customer not found')
    await session.delete(customer)
    logger.info('Deleted customer %s', customer_id)
