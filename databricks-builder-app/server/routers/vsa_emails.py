"""VSA Emails router — email inbox, classification, and task creation."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..db import session_scope
from ..db.models import VsaCustomer, VsaEmail, VsaEmailTemplate, VsaOrder, VsaProduct, VsaTask
from ..services.vsa_agent import (
  classify_email,
  draft_customer_issue_reply,
  draft_general_inquiry_reply,
  draft_missing_info_reply,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class EmailIn(BaseModel):
  """Manual email entry payload."""

  sender_name: str | None = None
  sender_email: str
  subject: str
  body: str


@router.get('/vsa/emails')
async def list_emails():
  """List all emails ordered by newest first."""
  async with session_scope() as session:
    result = await session.execute(
      select(VsaEmail).order_by(VsaEmail.received_at.desc())
    )
    emails = result.scalars().all()
    return [e.to_dict() for e in emails]


@router.post('/vsa/emails', status_code=201)
async def create_email(body: EmailIn):
  """Create a new email manually."""
  async with session_scope() as session:
    email = VsaEmail(
      sender_name=body.sender_name,
      sender_email=body.sender_email.lower().strip(),
      subject=body.subject,
      body=body.body,
      status='pending',
    )
    session.add(email)
    await session.flush()
    await session.refresh(email)
    logger.info('Created email %s', email.id)
    return email.to_dict()


@router.post('/vsa/emails/from-template/{template_id}', status_code=201)
async def create_email_from_template(template_id: str):
  """Create an email from a saved template."""
  async with session_scope() as session:
    template = await session.get(VsaEmailTemplate, template_id)
    if not template:
      raise HTTPException(status_code=404, detail='Template not found')
    email = VsaEmail(
      sender_name=None,
      sender_email='template@example.com',
      subject=template.subject,
      body=template.body,
      status='pending',
      template_id=template_id,
    )
    session.add(email)
    await session.flush()
    await session.refresh(email)
    logger.info('Created email %s from template %s', email.id, template_id)
    return email.to_dict()


@router.post('/vsa/emails/{email_id}/classify')
async def classify_and_create_task(email_id: str):
  """Classify an email with the LLM and create a task.

  Returns the created task dict.
  """
  async with session_scope() as session:
    email = await session.get(VsaEmail, email_id)
    if not email:
      raise HTTPException(status_code=404, detail='Email not found')
    if email.status == 'classified':
      raise HTTPException(status_code=409, detail='Email already classified')

    # Load all products for context
    products_result = await session.execute(select(VsaProduct).order_by(VsaProduct.name))
    products = products_result.scalars().all()
    products_list = [p.to_dict() for p in products]

    logger.info('Classifying email %s', email_id)
    classification_data = classify_email(email.subject, email.body)
    classification = classification_data.get('classification', 'general_question')
    sender_email_extracted = classification_data.get('sender_email') or email.sender_email

    # Update email with classification
    email.classification = classification
    email.status = 'classified'
    if classification_data.get('sender_name') and not email.sender_name:
      email.sender_name = classification_data['sender_name']

    task = VsaTask(email_id=email.id, task_type=_map_classification(classification), status='open')

    if classification == 'order':
      # Look up customer by email
      customer_result = await session.execute(
        select(VsaCustomer).where(VsaCustomer.email == sender_email_extracted.lower().strip())
      )
      customer = customer_result.scalar_one_or_none()

      # Try to match a product by name mention
      product_mentions = classification_data.get('product_mentions', [])
      matched_product = None
      if product_mentions:
        for prod in products:
          if any(mention.lower() in prod.name.lower() or prod.name.lower() in mention.lower()
                 for mention in product_mentions):
            matched_product = prod
            break

      if matched_product:
        task.product_id = matched_product.id

      if customer:
        task.customer_id = customer.id
        missing = _find_missing_fields(customer)
        if missing:
          task.draft_reply = draft_missing_info_reply(email.subject, email.body, missing)
        else:
          task.draft_reply = (
            f'Dear {customer.name},\n\nThank you for your order! '
            'We have received your request and will process it shortly.\n\n'
            'Best regards,\nThe Spice Mix Team'
          )
      else:
        # Unknown customer — ask for details
        missing = ['full name', 'delivery address', 'phone number']
        task.draft_reply = draft_missing_info_reply(email.subject, email.body, missing)

    elif classification == 'customer_issue':
      result = draft_customer_issue_reply(email.subject, email.body, products_list)
      task.problem_summary = result['problem_summary']
      task.solution_summary = result['solution_summary']
      task.draft_reply = result['draft_reply']

    else:  # general_question
      task.draft_reply = draft_general_inquiry_reply(email.subject, email.body, products_list)

    session.add(task)
    await session.flush()

    # Expire and reload task with all relationships (avoid identity-map cache)
    await session.refresh(task)
    task_result = await session.execute(
      select(VsaTask)
      .where(VsaTask.id == task.id)
      .options(
        selectinload(VsaTask.email),
        selectinload(VsaTask.customer),
        selectinload(VsaTask.product),
        selectinload(VsaTask.order).selectinload(VsaOrder.customer),
        selectinload(VsaTask.order).selectinload(VsaOrder.product),
      )
    )
    task_reloaded = task_result.scalar_one()
    logger.info('Created task %s (type=%s) for email %s', task.id, task.task_type, email_id)
    return task_reloaded.to_dict()


@router.delete('/vsa/emails/{email_id}', status_code=204)
async def delete_email(email_id: str):
  """Delete an email and its associated task."""
  async with session_scope() as session:
    email = await session.get(VsaEmail, email_id)
    if not email:
      raise HTTPException(status_code=404, detail='Email not found')
    await session.delete(email)
    logger.info('Deleted email %s', email_id)


def _map_classification(classification: str) -> str:
  return {
    'order': 'new_order',
    'customer_issue': 'customer_issue',
    'general_question': 'general_inquiry',
  }.get(classification, 'general_inquiry')


def _find_missing_fields(customer: VsaCustomer) -> list[str]:
  missing = []
  if not customer.address:
    missing.append('delivery address')
  if not customer.phone:
    missing.append('phone number')
  return missing
