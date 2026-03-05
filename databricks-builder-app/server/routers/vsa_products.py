"""VSA Products router — spice mix product catalog CRUD."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from ..db import session_scope
from ..db.models import VsaProduct

logger = logging.getLogger(__name__)
router = APIRouter()


class ProductIn(BaseModel):
  """Product create/update payload."""

  name: str
  description: str | None = None
  ingredients: str | None = None
  price: float | None = None
  unit: str | None = None
  stock: int = 100


@router.get('/vsa/products')
async def list_products():
  """List all products."""
  async with session_scope() as session:
    result = await session.execute(select(VsaProduct).order_by(VsaProduct.name))
    products = result.scalars().all()
    return [p.to_dict() for p in products]


@router.post('/vsa/products', status_code=201)
async def create_product(body: ProductIn):
  """Create a new product."""
  async with session_scope() as session:
    product = VsaProduct(
      name=body.name,
      description=body.description,
      ingredients=body.ingredients,
      price=body.price,
      unit=body.unit,
      stock=body.stock,
    )
    session.add(product)
    await session.flush()
    await session.refresh(product)
    logger.info('Created product %s', product.id)
    return product.to_dict()


@router.patch('/vsa/products/{product_id}')
async def update_product(product_id: str, body: ProductIn):
  """Update a product."""
  async with session_scope() as session:
    product = await session.get(VsaProduct, product_id)
    if not product:
      raise HTTPException(status_code=404, detail='Product not found')
    product.name = body.name
    product.description = body.description
    product.ingredients = body.ingredients
    product.price = body.price
    product.unit = body.unit
    product.stock = body.stock
    await session.flush()
    await session.refresh(product)
    return product.to_dict()


@router.delete('/vsa/products/{product_id}', status_code=204)
async def delete_product(product_id: str):
  """Delete a product."""
  async with session_scope() as session:
    product = await session.get(VsaProduct, product_id)
    if not product:
      raise HTTPException(status_code=404, detail='Product not found')
    await session.delete(product)
    logger.info('Deleted product %s', product_id)
