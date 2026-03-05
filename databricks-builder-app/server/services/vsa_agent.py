"""LLM service for the Virtual Service Assistant.

Handles email classification and AI-drafted reply generation using LiteLLM
with the configured Databricks foundation model.
"""

import json
import logging
import os
import re

logger = logging.getLogger(__name__)

_MODEL = os.getenv('DATABRICKS_MODEL', 'databricks-meta-llama-3-3-70b-instruct')
_BASE_URL = None  # resolved lazily


def _get_litellm_kwargs() -> dict:
  """Build LiteLLM kwargs with Databricks auth."""
  import litellm
  from databricks.sdk import WorkspaceClient

  w = WorkspaceClient()
  token = w.config.token
  host = w.config.host

  return {
    'model': f'databricks/{_MODEL}',
    'api_base': f'{host}/serving-endpoints',
    'api_key': token,
  }


def _extract_json(text: str) -> dict:
  """Extract the first JSON object from an LLM response string."""
  # Try to find a JSON block (```json ... ``` or raw {...})
  match = re.search(r'```json\s*([\s\S]+?)\s*```', text)
  if match:
    return json.loads(match.group(1))
  match = re.search(r'\{[\s\S]+\}', text)
  if match:
    return json.loads(match.group(0))
  raise ValueError(f'No JSON found in LLM response: {text[:200]}')


def classify_email(subject: str, body: str) -> dict:
  """Classify an email and extract structured metadata.

  Returns:
    {
      classification: "order" | "customer_issue" | "general_question",
      sender_name: str | None,
      sender_email: str | None,
      product_mentions: list[str],
      issue_description: str | None,
      confidence: "high" | "medium" | "low",
    }
  """
  import litellm

  system_prompt = (
    'You are an email classifier for a spice mix shop. '
    'Respond ONLY with a JSON object — no markdown, no explanation, just the JSON.\n\n'
    'JSON fields:\n'
    '  classification: one of "order", "customer_issue", or "general_question"\n'
    '  sender_name: string or null\n'
    '  sender_email: string or null\n'
    '  product_mentions: array of strings\n'
    '  issue_description: one-sentence summary\n'
    '  confidence: "high", "medium", or "low"\n\n'
    'RULES:\n'
    '  "order" — customer wants to BUY or PURCHASE products\n'
    '  "customer_issue" — customer complains about or reports a problem with a past purchase:\n'
    '    wrong product sent, damaged goods, missing delivery, wants refund/return/replacement,\n'
    '    allergy reaction, billing mistake, disappointed with received product\n'
    '  "general_question" — customer asks for information only (ingredients, price, availability,\n'
    '    shipping time) with NO complaint about a past order\n\n'
    'EXAMPLES:\n'
    '---\n'
    'Subject: Order request\n'
    'Body: Hi, I would like to order 2 bags of Harissa Fire Mix please.\n'
    '{"classification":"order","sender_name":null,"sender_email":null,"product_mentions":["Harissa Fire Mix"],"issue_description":"Customer wants to purchase Harissa Fire Mix.","confidence":"high"}\n'
    '---\n'
    'Subject: Wrong item received\n'
    'Body: I ordered Smoky Tuscan Blend but you sent me Berbere instead. Very disappointed.\n'
    '{"classification":"customer_issue","sender_name":null,"sender_email":null,"product_mentions":["Smoky Tuscan Blend","Berbere"],"issue_description":"Customer received wrong product and is requesting the correct item.","confidence":"high"}\n'
    '---\n'
    'Subject: Damaged package\n'
    'Body: My package arrived completely crushed and the spices spilled everywhere. I need a replacement.\n'
    '{"classification":"customer_issue","sender_name":null,"sender_email":null,"product_mentions":[],"issue_description":"Customer received a damaged package and requests a replacement.","confidence":"high"}\n'
    '---\n'
    'Subject: Missing delivery\n'
    'Body: I placed an order 3 weeks ago and it still hasn\'t arrived. Where is my order?\n'
    '{"classification":"customer_issue","sender_name":null,"sender_email":null,"product_mentions":[],"issue_description":"Customer\'s order has not arrived after 3 weeks.","confidence":"high"}\n'
    '---\n'
    'Subject: Ingredient question\n'
    'Body: Does your Za\'atar blend contain sesame seeds? I have a sesame allergy.\n'
    '{"classification":"general_question","sender_name":null,"sender_email":null,"product_mentions":["Za\'atar"],"issue_description":"Customer asking about sesame content in Za\'atar blend.","confidence":"high"}\n'
    '---\n'
    'Now classify this email:\n'
  )

  user_prompt = f'Subject: {subject}\nBody: {body}'

  try:
    kwargs = _get_litellm_kwargs()
    response = litellm.completion(
      messages=[
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
      ],
      temperature=0.1,
      max_tokens=512,
      **kwargs,
    )
    raw = response.choices[0].message.content or ''
    logger.info('classify_email raw response: %s', raw[:300])
    result = _extract_json(raw)
    # Normalise
    result.setdefault('classification', 'general_question')
    result.setdefault('sender_name', None)
    result.setdefault('sender_email', None)
    result.setdefault('product_mentions', [])
    result.setdefault('issue_description', None)
    result.setdefault('confidence', 'medium')
    return result
  except Exception as e:
    logger.exception('classify_email failed: %s', e)
    return {
      'classification': 'general_question',
      'sender_name': None,
      'sender_email': None,
      'product_mentions': [],
      'issue_description': str(e),
      'confidence': 'low',
    }


def draft_general_inquiry_reply(subject: str, body: str, products_catalog: list[dict]) -> str:
  """Draft a helpful reply to a general inquiry email.

  Args:
    subject: Email subject
    body: Email body
    products_catalog: List of product dicts with name, description, price, unit

  Returns:
    Draft reply string.
  """
  import litellm

  catalog_text = '\n'.join(
    f'- {p["name"]} ({p["unit"]}, €{p["price"]}): {p["description"]}'
    for p in products_catalog[:12]
  )

  system_prompt = (
    'You are a helpful and friendly customer service agent for a premium spice mix shop. '
    'Write a professional, warm reply to the customer\'s general inquiry. '
    'Use the product catalog below to answer questions accurately. '
    'Be concise but thorough. Sign off as "The Spice Mix Team".\n\n'
    f'Product catalog:\n{catalog_text}'
  )

  user_prompt = f'Customer email:\nSubject: {subject}\n\n{body}'

  try:
    kwargs = _get_litellm_kwargs()
    response = litellm.completion(
      messages=[
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
      ],
      temperature=0.4,
      max_tokens=800,
      **kwargs,
    )
    return response.choices[0].message.content or 'We appreciate your message and will get back to you soon.'
  except Exception as e:
    logger.exception('draft_general_inquiry_reply failed: %s', e)
    return (
      'Dear Customer,\n\nThank you for reaching out. '
      'We have received your inquiry and will respond with more details shortly.\n\n'
      'Best regards,\nThe Spice Mix Team'
    )


def draft_customer_issue_reply(subject: str, body: str, products_catalog: list[dict]) -> dict:
  """Draft a resolution reply for a customer issue.

  Returns:
    {
      problem_summary: str,
      solution_summary: str,
      draft_reply: str,
    }
  """
  import litellm

  catalog_text = '\n'.join(f'- {p["name"]}' for p in products_catalog[:12])

  system_prompt = (
    'You are an empathetic customer service agent for a premium spice mix shop. '
    'Analyse the customer complaint and produce a JSON response with these three fields:\n'
    '  - problem_summary: one sentence describing the customer\'s problem\n'
    '  - solution_summary: one sentence describing how you will resolve it\n'
    '  - draft_reply: a full, polite email reply to the customer that acknowledges '
    'the issue, apologises, explains the resolution, and ends with "Best regards, The Spice Mix Team"\n\n'
    f'Available products: {catalog_text}\n\n'
    'Respond ONLY with a valid JSON object.'
  )

  user_prompt = f'Subject: {subject}\n\n{body}'

  try:
    kwargs = _get_litellm_kwargs()
    response = litellm.completion(
      messages=[
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
      ],
      temperature=0.3,
      max_tokens=1000,
      **kwargs,
    )
    raw = response.choices[0].message.content or ''
    result = _extract_json(raw)
    return {
      'problem_summary': result.get('problem_summary', 'Issue reported by customer.'),
      'solution_summary': result.get('solution_summary', 'We will investigate and resolve this promptly.'),
      'draft_reply': result.get('draft_reply', 'Dear Customer,\n\nThank you for contacting us. We are looking into this.\n\nBest regards,\nThe Spice Mix Team'),
    }
  except Exception as e:
    logger.exception('draft_customer_issue_reply failed: %s', e)
    return {
      'problem_summary': 'Customer reported an issue with their order.',
      'solution_summary': 'We will investigate and provide a resolution.',
      'draft_reply': (
        'Dear Customer,\n\nThank you for contacting us. '
        'We sincerely apologise for the inconvenience and are looking into this right away. '
        'We will follow up with a resolution shortly.\n\n'
        'Best regards,\nThe Spice Mix Team'
      ),
    }


def draft_missing_info_reply(subject: str, body: str, missing_fields: list[str]) -> str:
  """Draft a polite email asking the customer for missing order details.

  Args:
    subject: Email subject
    body: Email body
    missing_fields: List of field names that are missing, e.g. ['address', 'phone']

  Returns:
    Draft reply string.
  """
  import litellm

  fields_text = ', '.join(missing_fields)

  system_prompt = (
    'You are a friendly customer service agent for a premium spice mix shop. '
    'The customer wants to place an order but we are missing some details. '
    f'Write a polite, brief email asking them to provide: {fields_text}. '
    'Keep it warm and professional. Sign off as "The Spice Mix Team".'
  )

  user_prompt = f'Original customer email:\nSubject: {subject}\n\n{body}'

  try:
    kwargs = _get_litellm_kwargs()
    response = litellm.completion(
      messages=[
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
      ],
      temperature=0.3,
      max_tokens=500,
      **kwargs,
    )
    return response.choices[0].message.content or ''
  except Exception as e:
    logger.exception('draft_missing_info_reply failed: %s', e)
    fields_list = '\n'.join(f'  - {f}' for f in missing_fields)
    return (
      f'Dear Customer,\n\nThank you for your order interest! '
      f'To process your order, we still need the following information:\n{fields_list}\n\n'
      'Please reply with these details and we will get your order sorted right away.\n\n'
      'Best regards,\nThe Spice Mix Team'
    )
