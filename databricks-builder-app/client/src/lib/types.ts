/**
 * Types matching the backend API and DB models.
 */

/** Current user info from GET /api/me */
export interface UserInfo {
  user: string;
  workspace_url: string | null;
  lakebase_configured: boolean;
  lakebase_project_id: string | null;
  lakebase_error: string | null;
}

/** Project from API (projects list/detail) */
export interface Project {
  id: string;
  name: string;
  user_email: string;
  created_at: string | null;
  conversation_count: number;
}

/** Conversation summary (list) or full (detail with messages) */
export interface Conversation {
  id: string;
  project_id: string;
  title: string;
  created_at: string | null;
  session_id?: string | null;
  cluster_id?: string | null;
  default_catalog?: string | null;
  default_schema?: string | null;
  warehouse_id?: string | null;
  workspace_folder?: string | null;
  messages?: Message[];
  message_count?: number;
}

/** Single message in a conversation */
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | null;
  is_error: boolean;
}

/** Databricks cluster from GET /api/clusters */
export interface Cluster {
  cluster_id: string;
  cluster_name: string | null;
  state: string;
  creator_user_name?: string | null;
}

/** Databricks SQL warehouse from GET /api/warehouses */
export interface Warehouse {
  warehouse_id: string;
  warehouse_name: string | null;
  state: string;
  cluster_size?: string | null;
  creator_name?: string | null;
  is_serverless?: boolean;
}

/** Todo item from agent TodoWrite tool */
export interface TodoItem {
  id?: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/** Skill with enabled status from GET .../skills/available */
export interface AvailableSkill {
  name: string;
  description: string;
  enabled: boolean;
}

/** Active or recent execution from GET .../executions */
export interface Execution {
  id: string;
  conversation_id: string;
  project_id: string;
  status: string;
  events: unknown[];
  error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ---------------------------------------------------------------------------
// Virtual Service Assistant types
// ---------------------------------------------------------------------------

export interface VsaProduct {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: number | null;
  unit: string | null;
  stock: number;
  created_at: string | null;
}

export interface VsaCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  company: string | null;
  created_at: string | null;
}

export interface VsaEmailTemplate {
  id: string;
  subject: string;
  body: string;
  hint_category: string | null;
  description: string | null;
  created_at: string | null;
}

export interface VsaEmail {
  id: string;
  sender_name: string | null;
  sender_email: string;
  subject: string;
  body: string;
  received_at: string | null;
  classification: 'order' | 'customer_issue' | 'general_question' | null;
  status: 'pending' | 'classified';
  template_id: string | null;
  created_at: string | null;
}

export interface VsaOrder {
  id: string;
  task_id: string;
  customer_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  delivery_address: string | null;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string | null;
  updated_at: string | null;
  customer: VsaCustomer | null;
  product: VsaProduct | null;
}

export interface VsaTask {
  id: string;
  email_id: string;
  task_type: 'new_order' | 'customer_issue' | 'general_inquiry';
  status: 'open' | 'in_progress' | 'resolved';
  customer_id: string | null;
  product_id: string | null;
  problem_summary: string | null;
  solution_summary: string | null;
  draft_reply: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  email: VsaEmail | null;
  customer: VsaCustomer | null;
  product: VsaProduct | null;
  order: VsaOrder | null;
}

export interface VsaTaskStats {
  by_status: { open: number; in_progress: number; resolved: number };
  by_type: { new_order: number; customer_issue: number; general_inquiry: number };
  total: number;
}
