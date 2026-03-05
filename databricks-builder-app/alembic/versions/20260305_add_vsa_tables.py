"""Add Virtual Service Assistant tables with seed data.

Revision ID: 20260305_vsa
Revises: 20260115_warehouse_workspace
Create Date: 2026-03-05 12:00:00.000000

"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '20260305_vsa'
down_revision: Union[str, None] = '20260115_warehouse_workspace'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _uuid() -> str:
  return str(uuid.uuid4())


def _now() -> datetime:
  return datetime.now(timezone.utc)


def upgrade() -> None:
  # -------------------------------------------------------------------------
  # Create vsa_products table
  # -------------------------------------------------------------------------
  op.create_table(
    'vsa_products',
    sa.Column('id', sa.String(50), primary_key=True),
    sa.Column('name', sa.String(255), nullable=False),
    sa.Column('description', sa.Text, nullable=True),
    sa.Column('ingredients', sa.Text, nullable=True),
    sa.Column('price', sa.Numeric(10, 2), nullable=True),
    sa.Column('unit', sa.String(50), nullable=True),
    sa.Column('stock', sa.Integer, nullable=False, server_default='100'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )

  # -------------------------------------------------------------------------
  # Create vsa_customers table
  # -------------------------------------------------------------------------
  op.create_table(
    'vsa_customers',
    sa.Column('id', sa.String(50), primary_key=True),
    sa.Column('name', sa.String(255), nullable=False),
    sa.Column('email', sa.String(255), nullable=False),
    sa.Column('phone', sa.String(50), nullable=True),
    sa.Column('address', sa.Text, nullable=True),
    sa.Column('company', sa.String(255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )
  op.create_index('ix_vsa_customers_email', 'vsa_customers', ['email'], unique=True)

  # -------------------------------------------------------------------------
  # Create vsa_email_templates table
  # -------------------------------------------------------------------------
  op.create_table(
    'vsa_email_templates',
    sa.Column('id', sa.String(50), primary_key=True),
    sa.Column('subject', sa.String(500), nullable=False),
    sa.Column('body', sa.Text, nullable=False),
    sa.Column('hint_category', sa.String(50), nullable=True),
    sa.Column('description', sa.String(500), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )

  # -------------------------------------------------------------------------
  # Create vsa_emails table
  # -------------------------------------------------------------------------
  op.create_table(
    'vsa_emails',
    sa.Column('id', sa.String(50), primary_key=True),
    sa.Column('sender_name', sa.String(255), nullable=True),
    sa.Column('sender_email', sa.String(255), nullable=False),
    sa.Column('subject', sa.String(500), nullable=False),
    sa.Column('body', sa.Text, nullable=False),
    sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('classification', sa.String(50), nullable=True),
    sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
    sa.Column(
      'template_id',
      sa.String(50),
      sa.ForeignKey('vsa_email_templates.id', ondelete='SET NULL'),
      nullable=True,
    ),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )
  op.create_index('ix_vsa_emails_status', 'vsa_emails', ['status'])

  # -------------------------------------------------------------------------
  # Create vsa_tasks table
  # -------------------------------------------------------------------------
  op.create_table(
    'vsa_tasks',
    sa.Column('id', sa.String(50), primary_key=True),
    sa.Column(
      'email_id',
      sa.String(50),
      sa.ForeignKey('vsa_emails.id', ondelete='CASCADE'),
      nullable=False,
    ),
    sa.Column('task_type', sa.String(50), nullable=False),
    sa.Column('status', sa.String(50), nullable=False, server_default='open'),
    sa.Column(
      'customer_id',
      sa.String(50),
      sa.ForeignKey('vsa_customers.id', ondelete='SET NULL'),
      nullable=True,
    ),
    sa.Column(
      'product_id',
      sa.String(50),
      sa.ForeignKey('vsa_products.id', ondelete='SET NULL'),
      nullable=True,
    ),
    sa.Column('problem_summary', sa.Text, nullable=True),
    sa.Column('solution_summary', sa.Text, nullable=True),
    sa.Column('draft_reply', sa.Text, nullable=True),
    sa.Column('notes', sa.Text, nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
  )
  op.create_index('ix_vsa_tasks_status_type', 'vsa_tasks', ['status', 'task_type'])

  # -------------------------------------------------------------------------
  # Seed: products
  # -------------------------------------------------------------------------
  products_table = sa.table(
    'vsa_products',
    sa.column('id', sa.String),
    sa.column('name', sa.String),
    sa.column('description', sa.Text),
    sa.column('ingredients', sa.Text),
    sa.column('price', sa.Numeric),
    sa.column('unit', sa.String),
    sa.column('stock', sa.Integer),
  )
  op.bulk_insert(
    products_table,
    [
      {
        'id': _uuid(),
        'name': 'Smoky Tuscan Blend',
        'description': 'A rich, smoky Italian-inspired spice mix perfect for grilled meats and roasted vegetables.',
        'ingredients': 'smoked paprika, rosemary, garlic, oregano, black pepper, sea salt, fennel seeds',
        'price': 8.99,
        'unit': '100g bag',
        'stock': 150,
      },
      {
        'id': _uuid(),
        'name': 'Harissa Fire Mix',
        'description': 'A fiery North African chili blend that brings heat and depth to any dish.',
        'ingredients': 'dried chili, caraway, coriander, garlic, cumin, smoked paprika, rose petals',
        'price': 9.49,
        'unit': '80g jar',
        'stock': 120,
      },
      {
        'id': _uuid(),
        'name': "Za'atar Garden Blend",
        'description': 'A fragrant Middle Eastern herb and spice mix, great on flatbreads and dips.',
        'ingredients': "thyme, sumac, sesame seeds, oregano, marjoram, sea salt",
        'price': 7.99,
        'unit': '75g bag',
        'stock': 200,
      },
      {
        'id': _uuid(),
        'name': 'Ras el Hanout',
        'description': 'The classic Moroccan spice blend with over a dozen warming spices.',
        'ingredients': 'cinnamon, cumin, coriander, cardamom, ginger, turmeric, allspice, nutmeg, black pepper, cloves',
        'price': 10.99,
        'unit': '90g jar',
        'stock': 100,
      },
      {
        'id': _uuid(),
        'name': 'Berbere Ethiopian Spice',
        'description': 'Bold and complex Ethiopian chili spice blend, essential for stews and lentils.',
        'ingredients': 'chili flakes, fenugreek, coriander, black pepper, allspice, ginger, cardamom, cinnamon',
        'price': 9.99,
        'unit': '85g bag',
        'stock': 90,
      },
      {
        'id': _uuid(),
        'name': 'Baharat Arabian Mix',
        'description': 'A warm and aromatic all-purpose Arabic spice blend for rice, lamb and chicken.',
        'ingredients': 'black pepper, coriander, cumin, cloves, cinnamon, cardamom, nutmeg, paprika',
        'price': 8.49,
        'unit': '80g bag',
        'stock': 130,
      },
      {
        'id': _uuid(),
        'name': 'Peri-Peri Flame',
        'description': 'South African peri-peri chili blend with citrus notes for marinades and sauces.',
        'ingredients': 'peri-peri chili, lemon zest, garlic, oregano, paprika, black pepper, sea salt',
        'price': 8.99,
        'unit': '75g jar',
        'stock': 110,
      },
      {
        'id': _uuid(),
        'name': 'Garam Masala Premium',
        'description': 'A freshly ground premium Indian warming spice blend for curries and dals.',
        'ingredients': 'cumin, coriander, cardamom, black pepper, cinnamon, cloves, bay leaf, mace',
        'price': 7.49,
        'unit': '100g bag',
        'stock': 180,
      },
      {
        'id': _uuid(),
        'name': 'Japanese Shichimi Togarashi',
        'description': 'Seven-spice Japanese seasoning for noodles, rice and grilled dishes.',
        'ingredients': 'chili flakes, sesame seeds, sansho pepper, nori, yuzu peel, ginger, hemp seeds',
        'price': 11.99,
        'unit': '60g jar',
        'stock': 75,
      },
      {
        'id': _uuid(),
        'name': 'Greek Islands Herb Blend',
        'description': 'A sunny Mediterranean herb mix inspired by the Greek island kitchens.',
        'ingredients': 'oregano, thyme, basil, rosemary, marjoram, lemon zest, sea salt, garlic',
        'price': 7.99,
        'unit': '80g bag',
        'stock': 160,
      },
      {
        'id': _uuid(),
        'name': 'Cajun Bayou Rub',
        'description': 'A bold American Cajun seasoning perfect for blackened fish, chicken and shrimp.',
        'ingredients': 'paprika, cayenne, garlic, onion, black pepper, thyme, oregano, celery salt',
        'price': 8.49,
        'unit': '90g bag',
        'stock': 140,
      },
      {
        'id': _uuid(),
        'name': 'Vadouvan French Curry',
        'description': 'A refined French-Indian fusion spice blend with shallot and fenugreek notes.',
        'ingredients': 'shallots, garlic, fenugreek, cumin, mustard seeds, turmeric, cardamom, curry leaves',
        'price': 12.49,
        'unit': '70g jar',
        'stock': 60,
      },
    ],
  )

  # -------------------------------------------------------------------------
  # Seed: customers (mix of complete and incomplete profiles)
  # -------------------------------------------------------------------------
  customers_table = sa.table(
    'vsa_customers',
    sa.column('id', sa.String),
    sa.column('name', sa.String),
    sa.column('email', sa.String),
    sa.column('phone', sa.String),
    sa.column('address', sa.Text),
    sa.column('company', sa.String),
  )
  op.bulk_insert(
    customers_table,
    [
      {
        'id': _uuid(),
        'name': 'Sophie Müller',
        'email': 'sophie.mueller@example.com',
        'phone': '+49 89 12345678',
        'address': 'Maximilianstraße 12, 80539 Munich, Germany',
        'company': None,
      },
      {
        'id': _uuid(),
        'name': 'James Harrison',
        'email': 'james.harrison@cookinglab.co.uk',
        'phone': '+44 20 7946 0958',
        'address': '34 Brick Lane, London E1 6RF, UK',
        'company': 'The Cooking Lab Ltd.',
      },
      {
        'id': _uuid(),
        'name': 'Fatima Al-Rashid',
        'email': 'fatima.alrashid@gmail.com',
        'phone': None,  # incomplete — no phone
        'address': None,  # incomplete — no address
        'company': None,
      },
      {
        'id': _uuid(),
        'name': 'Marco Rossi',
        'email': 'marco.rossi@ristorantesole.it',
        'phone': '+39 02 8765 4321',
        'address': 'Via Montenapoleone 8, 20121 Milan, Italy',
        'company': 'Ristorante Il Sole',
      },
      {
        'id': _uuid(),
        'name': 'Priya Nair',
        'email': 'priya.nair@spiceroute.in',
        'phone': None,  # incomplete — no phone
        'address': '42 MG Road, Bangalore 560001, India',
        'company': 'Spice Route Imports',
      },
    ],
  )

  # -------------------------------------------------------------------------
  # Seed: email templates (3 per category)
  # -------------------------------------------------------------------------
  templates_table = sa.table(
    'vsa_email_templates',
    sa.column('id', sa.String),
    sa.column('subject', sa.String),
    sa.column('body', sa.Text),
    sa.column('hint_category', sa.String),
    sa.column('description', sa.String),
  )
  op.bulk_insert(
    templates_table,
    [
      # ---- Orders ----
      {
        'id': _uuid(),
        'subject': 'Order request – Smoky Tuscan Blend x3',
        'body': (
          'Hi,\n\n'
          'My name is Sophie Müller and I would like to place an order.\n\n'
          'I would like to order 3 bags of the Smoky Tuscan Blend (100g). '
          'Please ship to: Maximilianstraße 12, 80539 Munich, Germany.\n\n'
          'Could you confirm availability and payment options?\n\n'
          'Best regards,\nSophie Müller\nsophie.mueller@example.com'
        ),
        'hint_category': 'order',
        'description': 'Known customer ordering a known product',
      },
      {
        'id': _uuid(),
        'subject': 'Bulk purchase inquiry – Garam Masala',
        'body': (
          'Hello,\n\n'
          'I am reaching out on behalf of The Cooking Lab Ltd. '
          'We are interested in purchasing 20 units of Garam Masala Premium for our kitchen.\n\n'
          'Please let me know pricing for bulk orders and estimated delivery time to London.\n\n'
          'Kind regards,\nJames Harrison\njames.harrison@cookinglab.co.uk'
        ),
        'hint_category': 'order',
        'description': 'Known customer bulk order inquiry',
      },
      {
        'id': _uuid(),
        'subject': 'Ordering Harissa Fire Mix',
        'body': (
          'Hi there,\n\n'
          'I saw your Harissa Fire Mix and I really want to try it. '
          'Can I order 2 jars? My email is new.customer@test.com and my name is Alex Weber.\n\n'
          'What is the total cost including shipping to Berlin?\n\n'
          'Thanks,\nAlex'
        ),
        'hint_category': 'order',
        'description': 'Unknown customer — missing address and phone, should trigger info request',
      },
      # ---- Customer issues ----
      {
        'id': _uuid(),
        'subject': 'Wrong product received',
        'body': (
          'Hello,\n\n'
          'I placed an order last week and received the Cajun Bayou Rub instead of the Za\'atar Garden Blend I ordered. '
          'This is quite disappointing as I needed it for a specific recipe.\n\n'
          'Could you please arrange for the correct product to be sent and provide a return label for the wrong item?\n\n'
          'My order was placed under: marco.rossi@ristorantesole.it\n\n'
          'Thank you,\nMarco Rossi'
        ),
        'hint_category': 'customer_issue',
        'description': 'Customer received wrong product',
      },
      {
        'id': _uuid(),
        'subject': 'Damaged packaging on delivery',
        'body': (
          'Hi,\n\n'
          'My recent order arrived with two of the spice jars completely broken. '
          'The Ras el Hanout and the Berbere jars were shattered and the contents spilled everywhere.\n\n'
          'I would like a refund or replacement. I can send photos if needed.\n\n'
          'Best,\nFatima Al-Rashid\nfatima.alrashid@gmail.com'
        ),
        'hint_category': 'customer_issue',
        'description': 'Customer reporting damaged delivery',
      },
      {
        'id': _uuid(),
        'subject': 'Quality complaint – stale spices',
        'body': (
          'Dear Customer Service,\n\n'
          'I ordered your Garam Masala Premium two weeks ago and unfortunately the spices smell stale. '
          'They lack the aroma I would expect from a premium product.\n\n'
          'I have used your products before and they were excellent, so something seems off with this batch.\n\n'
          'Can you investigate? My contact: priya.nair@spiceroute.in\n\n'
          'Regards,\nPriya Nair'
        ),
        'hint_category': 'customer_issue',
        'description': 'Quality complaint about a product batch',
      },
      # ---- General questions ----
      {
        'id': _uuid(),
        'subject': 'Do you offer allergen-free options?',
        'body': (
          'Hello,\n\n'
          'I am highly allergic to sesame seeds and nuts. '
          'Could you let me know which of your spice blends are free from these allergens?\n\n'
          'Also, are your products produced in a facility that handles nuts?\n\n'
          'Thanks in advance,\nLena Schmidt\nlena.schmidt@web.de'
        ),
        'hint_category': 'general_question',
        'description': 'Allergen information request',
      },
      {
        'id': _uuid(),
        'subject': 'International shipping – do you deliver to Australia?',
        'body': (
          'Hi,\n\n'
          'I came across your spice range online and I am very interested. '
          'Do you ship internationally? Specifically to Sydney, Australia?\n\n'
          'If so, what are the typical shipping costs and delivery times?\n\n'
          'Thank you,\nDavid Chen'
        ),
        'hint_category': 'general_question',
        'description': 'International shipping inquiry',
      },
      {
        'id': _uuid(),
        'subject': 'Recipe suggestion for Ras el Hanout',
        'body': (
          'Dear team,\n\n'
          'I recently bought your Ras el Hanout and I love it! '
          'Could you suggest some recipes where it works particularly well? '
          'I am thinking about Moroccan dishes but would love other ideas too.\n\n'
          'Also, can it be used as a dry rub for BBQ?\n\n'
          'Best,\nAnna Kowalski'
        ),
        'hint_category': 'general_question',
        'description': 'Recipe and usage questions',
      },
    ],
  )


def downgrade() -> None:
  op.drop_index('ix_vsa_tasks_status_type', table_name='vsa_tasks')
  op.drop_table('vsa_tasks')
  op.drop_index('ix_vsa_emails_status', table_name='vsa_emails')
  op.drop_table('vsa_emails')
  op.drop_table('vsa_email_templates')
  op.drop_index('ix_vsa_customers_email', table_name='vsa_customers')
  op.drop_table('vsa_customers')
  op.drop_table('vsa_products')
