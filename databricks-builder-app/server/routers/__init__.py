"""API routers module."""

from .agent import router as agent_router
from .clusters import router as clusters_router
from .config import router as config_router
from .conversations import router as conversations_router
from .projects import router as projects_router
from .skills import router as skills_router
from .vsa_customers import router as vsa_customers_router
from .vsa_emails import router as vsa_emails_router
from .vsa_orders import router as vsa_orders_router
from .vsa_products import router as vsa_products_router
from .vsa_tasks import router as vsa_tasks_router
from .vsa_templates import router as vsa_templates_router
from .warehouses import router as warehouses_router

__all__ = [
  'agent_router',
  'clusters_router',
  'config_router',
  'conversations_router',
  'projects_router',
  'skills_router',
  'vsa_customers_router',
  'vsa_emails_router',
  'vsa_orders_router',
  'vsa_products_router',
  'vsa_tasks_router',
  'vsa_templates_router',
  'warehouses_router',
]
