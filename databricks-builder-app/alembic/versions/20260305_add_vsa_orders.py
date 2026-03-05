"""Add vsa_orders table.

Revision ID: 20260305_add_vsa_orders
Revises: 20260305_add_vsa_tables
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa

revision = '20260305_add_vsa_orders'
down_revision = '20260305_add_vsa_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
  op.create_table(
    'vsa_orders',
    sa.Column('id', sa.String(50), primary_key=True),
    sa.Column('task_id', sa.String(50), sa.ForeignKey('vsa_tasks.id', ondelete='CASCADE'), nullable=False, unique=True),
    sa.Column('customer_id', sa.String(50), sa.ForeignKey('vsa_customers.id', ondelete='CASCADE'), nullable=False),
    sa.Column('product_id', sa.String(50), sa.ForeignKey('vsa_products.id', ondelete='SET NULL'), nullable=True),
    sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
    sa.Column('unit_price', sa.Numeric(10, 2), nullable=True),
    sa.Column('total_price', sa.Numeric(10, 2), nullable=True),
    sa.Column('delivery_address', sa.Text(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
  )
  op.create_index('ix_vsa_orders_task_id', 'vsa_orders', ['task_id'])
  op.create_index('ix_vsa_orders_customer_id', 'vsa_orders', ['customer_id'])
  op.create_index('ix_vsa_orders_status', 'vsa_orders', ['status'])


def downgrade() -> None:
  op.drop_table('vsa_orders')
