"""VSA Email Templates router — test email template CRUD."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from ..db import session_scope
from ..db.models import VsaEmailTemplate

logger = logging.getLogger(__name__)
router = APIRouter()


class TemplateIn(BaseModel):
  """Email template create/update payload."""

  subject: str
  body: str
  hint_category: str | None = None
  description: str | None = None


@router.get('/vsa/templates')
async def list_templates():
  """List all email templates."""
  async with session_scope() as session:
    result = await session.execute(
      select(VsaEmailTemplate).order_by(VsaEmailTemplate.hint_category, VsaEmailTemplate.subject)
    )
    templates = result.scalars().all()
    return [t.to_dict() for t in templates]


@router.post('/vsa/templates', status_code=201)
async def create_template(body: TemplateIn):
  """Create a new email template."""
  async with session_scope() as session:
    template = VsaEmailTemplate(
      subject=body.subject,
      body=body.body,
      hint_category=body.hint_category,
      description=body.description,
    )
    session.add(template)
    await session.flush()
    await session.refresh(template)
    logger.info('Created template %s', template.id)
    return template.to_dict()


@router.patch('/vsa/templates/{template_id}')
async def update_template(template_id: str, body: TemplateIn):
  """Update an email template."""
  async with session_scope() as session:
    template = await session.get(VsaEmailTemplate, template_id)
    if not template:
      raise HTTPException(status_code=404, detail='Template not found')
    template.subject = body.subject
    template.body = body.body
    template.hint_category = body.hint_category
    template.description = body.description
    await session.flush()
    await session.refresh(template)
    return template.to_dict()


@router.delete('/vsa/templates/{template_id}', status_code=204)
async def delete_template(template_id: str):
  """Delete an email template."""
  async with session_scope() as session:
    template = await session.get(VsaEmailTemplate, template_id)
    if not template:
      raise HTTPException(status_code=404, detail='Template not found')
    await session.delete(template)
    logger.info('Deleted template %s', template_id)
