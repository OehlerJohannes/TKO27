"""Database models for Projects, Conversations, and Messages."""

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, LargeBinary, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def generate_uuid() -> str:
  return str(uuid.uuid4())


def utc_now() -> datetime:
  return datetime.now(timezone.utc)


class Base(DeclarativeBase):
  """Base class for SQLAlchemy models."""

  pass


class Project(Base):
  """Project model - user-scoped container for conversations."""

  __tablename__ = 'projects'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  name: Mapped[str] = mapped_column(String(255), nullable=False)
  user_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=utc_now, nullable=False
  )

  # Relationships
  conversations: Mapped[List['Conversation']] = relationship(
    'Conversation', back_populates='project', cascade='all, delete-orphan'
  )

  __table_args__ = (Index('ix_projects_user_created', 'user_email', 'created_at'),)

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary."""
    return {
      'id': self.id,
      'name': self.name,
      'user_email': self.user_email,
      'created_at': self.created_at.isoformat() if self.created_at else None,
      'conversation_count': len(self.conversations) if self.conversations else 0,
    }


class Conversation(Base):
  """Conversation model - represents a Claude Code agent session."""

  __tablename__ = 'conversations'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  project_id: Mapped[str] = mapped_column(
    String(50), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False
  )
  title: Mapped[str] = mapped_column(String(255), default='New Conversation')
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=utc_now, nullable=False
  )

  # Claude agent session ID (for resuming sessions)
  session_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

  # Databricks cluster ID for code execution
  cluster_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

  # Default Unity Catalog context
  default_catalog: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
  default_schema: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

  # Databricks SQL warehouse ID for SQL queries
  warehouse_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

  # Workspace folder for uploading files (e.g., /Workspace/Users/email/project)
  workspace_folder: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

  # Relationships
  project: Mapped['Project'] = relationship('Project', back_populates='conversations')
  messages: Mapped[List['Message']] = relationship(
    'Message', back_populates='conversation', cascade='all, delete-orphan'
  )

  __table_args__ = (Index('ix_conversations_project_created', 'project_id', 'created_at'),)

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary with messages."""
    return {
      'id': self.id,
      'project_id': self.project_id,
      'title': self.title,
      'created_at': self.created_at.isoformat() if self.created_at else None,
      'session_id': self.session_id,
      'cluster_id': self.cluster_id,
      'default_catalog': self.default_catalog,
      'default_schema': self.default_schema,
      'warehouse_id': self.warehouse_id,
      'workspace_folder': self.workspace_folder,
      'messages': [m.to_dict() for m in self.messages] if self.messages else [],
    }

  def to_dict_summary(self) -> dict[str, Any]:
    """Convert to dictionary without messages (for list views)."""
    return {
      'id': self.id,
      'project_id': self.project_id,
      'title': self.title,
      'created_at': self.created_at.isoformat() if self.created_at else None,
      'cluster_id': self.cluster_id,
      'default_catalog': self.default_catalog,
      'default_schema': self.default_schema,
      'warehouse_id': self.warehouse_id,
      'workspace_folder': self.workspace_folder,
      'message_count': len(self.messages) if self.messages else 0,
    }


class Message(Base):
  """Message model - individual chat messages within a conversation."""

  __tablename__ = 'messages'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  conversation_id: Mapped[str] = mapped_column(
    String(50), ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False
  )
  role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" or "assistant"
  content: Mapped[str] = mapped_column(Text, nullable=False)
  timestamp: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=utc_now, nullable=False
  )
  is_error: Mapped[bool] = mapped_column(Boolean, default=False)

  # Relationships
  conversation: Mapped['Conversation'] = relationship('Conversation', back_populates='messages')

  __table_args__ = (Index('ix_messages_conversation_timestamp', 'conversation_id', 'timestamp'),)

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary."""
    return {
      'id': self.id,
      'conversation_id': self.conversation_id,
      'role': self.role,
      'content': self.content,
      'timestamp': self.timestamp.isoformat() if self.timestamp else None,
      'is_error': self.is_error,
    }


class ProjectBackup(Base):
  """Stores zipped backup of project files for restore after app restart."""

  __tablename__ = 'project_backup'

  project_id: Mapped[str] = mapped_column(
    String(50), ForeignKey('projects.id', ondelete='CASCADE'), primary_key=True
  )
  backup_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
  )


class Execution(Base):
  """Stores execution state for session independence.

  Allows users to reconnect to running/completed executions after
  navigating away or refreshing the page.
  """

  __tablename__ = 'executions'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  conversation_id: Mapped[str] = mapped_column(
    String(50), ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False
  )
  project_id: Mapped[str] = mapped_column(
    String(50), ForeignKey('projects.id', ondelete='CASCADE'), nullable=False
  )
  status: Mapped[str] = mapped_column(
    String(20), nullable=False, default='running'
  )  # running, completed, cancelled, error
  events_json: Mapped[str] = mapped_column(
    Text, nullable=False, default='[]'
  )  # JSON array of events
  error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=utc_now, nullable=False
  )
  updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
  )

  __table_args__ = (
    Index('ix_executions_conversation_status', 'conversation_id', 'status'),
    Index('ix_executions_conversation_created', 'conversation_id', 'created_at'),
  )

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary."""
    import json
    return {
      'id': self.id,
      'conversation_id': self.conversation_id,
      'project_id': self.project_id,
      'status': self.status,
      'events': json.loads(self.events_json) if self.events_json else [],
      'error': self.error,
      'created_at': self.created_at.isoformat() if self.created_at else None,
      'updated_at': self.updated_at.isoformat() if self.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Virtual Service Assistant models
# ---------------------------------------------------------------------------


class VsaProduct(Base):
  """Spice mix product catalog."""

  __tablename__ = 'vsa_products'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  name: Mapped[str] = mapped_column(String(255), nullable=False)
  description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  ingredients: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
  unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
  stock: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

  tasks: Mapped[List['VsaTask']] = relationship('VsaTask', back_populates='product')

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary."""
    return {
      'id': self.id,
      'name': self.name,
      'description': self.description,
      'ingredients': self.ingredients,
      'price': float(self.price) if self.price is not None else None,
      'unit': self.unit,
      'stock': self.stock,
      'created_at': self.created_at.isoformat() if self.created_at else None,
    }


class VsaCustomer(Base):
  """Customer directory."""

  __tablename__ = 'vsa_customers'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  name: Mapped[str] = mapped_column(String(255), nullable=False)
  email: Mapped[str] = mapped_column(String(255), nullable=False)
  phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
  address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

  tasks: Mapped[List['VsaTask']] = relationship('VsaTask', back_populates='customer')

  __table_args__ = (Index('ix_vsa_customers_email', 'email', unique=True),)

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary."""
    return {
      'id': self.id,
      'name': self.name,
      'email': self.email,
      'phone': self.phone,
      'address': self.address,
      'company': self.company,
      'created_at': self.created_at.isoformat() if self.created_at else None,
    }


class VsaEmailTemplate(Base):
  """Sample email templates for testing the classifier."""

  __tablename__ = 'vsa_email_templates'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  subject: Mapped[str] = mapped_column(String(500), nullable=False)
  body: Mapped[str] = mapped_column(Text, nullable=False)
  hint_category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
  description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

  emails: Mapped[List['VsaEmail']] = relationship('VsaEmail', back_populates='template')

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary."""
    return {
      'id': self.id,
      'subject': self.subject,
      'body': self.body,
      'hint_category': self.hint_category,
      'description': self.description,
      'created_at': self.created_at.isoformat() if self.created_at else None,
    }


class VsaEmail(Base):
  """Incoming customer emails."""

  __tablename__ = 'vsa_emails'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  sender_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
  sender_email: Mapped[str] = mapped_column(String(255), nullable=False)
  subject: Mapped[str] = mapped_column(String(500), nullable=False)
  body: Mapped[str] = mapped_column(Text, nullable=False)
  received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
  classification: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
  status: Mapped[str] = mapped_column(String(50), nullable=False, default='pending')
  template_id: Mapped[Optional[str]] = mapped_column(
    String(50), ForeignKey('vsa_email_templates.id', ondelete='SET NULL'), nullable=True
  )
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

  template: Mapped[Optional['VsaEmailTemplate']] = relationship('VsaEmailTemplate', back_populates='emails')
  task: Mapped[Optional['VsaTask']] = relationship('VsaTask', back_populates='email', uselist=False)

  __table_args__ = (Index('ix_vsa_emails_status', 'status'),)

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary."""
    return {
      'id': self.id,
      'sender_name': self.sender_name,
      'sender_email': self.sender_email,
      'subject': self.subject,
      'body': self.body,
      'received_at': self.received_at.isoformat() if self.received_at else None,
      'classification': self.classification,
      'status': self.status,
      'template_id': self.template_id,
      'created_at': self.created_at.isoformat() if self.created_at else None,
    }


class VsaTask(Base):
  """Tasks created from classified emails."""

  __tablename__ = 'vsa_tasks'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  email_id: Mapped[str] = mapped_column(
    String(50), ForeignKey('vsa_emails.id', ondelete='CASCADE'), nullable=False
  )
  task_type: Mapped[str] = mapped_column(String(50), nullable=False)
  status: Mapped[str] = mapped_column(String(50), nullable=False, default='open')
  customer_id: Mapped[Optional[str]] = mapped_column(
    String(50), ForeignKey('vsa_customers.id', ondelete='SET NULL'), nullable=True
  )
  product_id: Mapped[Optional[str]] = mapped_column(
    String(50), ForeignKey('vsa_products.id', ondelete='SET NULL'), nullable=True
  )
  problem_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  solution_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  draft_reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
  )

  email: Mapped['VsaEmail'] = relationship('VsaEmail', back_populates='task')
  customer: Mapped[Optional['VsaCustomer']] = relationship('VsaCustomer', back_populates='tasks')
  product: Mapped[Optional['VsaProduct']] = relationship('VsaProduct', back_populates='tasks')
  order: Mapped[Optional['VsaOrder']] = relationship('VsaOrder', back_populates='task', uselist=False)

  __table_args__ = (Index('ix_vsa_tasks_status_type', 'status', 'task_type'),)

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary."""
    return {
      'id': self.id,
      'email_id': self.email_id,
      'task_type': self.task_type,
      'status': self.status,
      'customer_id': self.customer_id,
      'product_id': self.product_id,
      'problem_summary': self.problem_summary,
      'solution_summary': self.solution_summary,
      'draft_reply': self.draft_reply,
      'notes': self.notes,
      'created_at': self.created_at.isoformat() if self.created_at else None,
      'updated_at': self.updated_at.isoformat() if self.updated_at else None,
      'email': self.email.to_dict() if self.email else None,
      'customer': self.customer.to_dict() if self.customer else None,
      'product': self.product.to_dict() if self.product else None,
      'order': self.order.to_dict() if self.order else None,
    }


class VsaOrder(Base):
  """Confirmed orders placed via the Virtual Service Assistant."""

  __tablename__ = 'vsa_orders'

  id: Mapped[str] = mapped_column(String(50), primary_key=True, default=generate_uuid)
  task_id: Mapped[str] = mapped_column(
    String(50), ForeignKey('vsa_tasks.id', ondelete='CASCADE'), nullable=False, unique=True
  )
  customer_id: Mapped[str] = mapped_column(
    String(50), ForeignKey('vsa_customers.id', ondelete='CASCADE'), nullable=False
  )
  product_id: Mapped[Optional[str]] = mapped_column(
    String(50), ForeignKey('vsa_products.id', ondelete='SET NULL'), nullable=True
  )
  quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
  unit_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
  total_price: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
  delivery_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
  status: Mapped[str] = mapped_column(String(50), nullable=False, default='pending')
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
  updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
  )

  task: Mapped['VsaTask'] = relationship('VsaTask', back_populates='order')
  customer: Mapped['VsaCustomer'] = relationship('VsaCustomer')
  product: Mapped[Optional['VsaProduct']] = relationship('VsaProduct')

  def to_dict(self) -> dict[str, Any]:
    """Convert to dictionary."""
    return {
      'id': self.id,
      'task_id': self.task_id,
      'customer_id': self.customer_id,
      'product_id': self.product_id,
      'quantity': self.quantity,
      'unit_price': float(self.unit_price) if self.unit_price is not None else None,
      'total_price': float(self.total_price) if self.total_price is not None else None,
      'delivery_address': self.delivery_address,
      'notes': self.notes,
      'status': self.status,
      'created_at': self.created_at.isoformat() if self.created_at else None,
      'updated_at': self.updated_at.isoformat() if self.updated_at else None,
      'customer': self.customer.to_dict() if self.customer else None,
      'product': self.product.to_dict() if self.product else None,
    }
