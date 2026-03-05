/**
 * Client API for the databricks-builder-app backend.
 * All routes are under /api (proxied in dev).
 */

import type {
  Cluster,
  Conversation,
  Execution,
  Project,
  UserInfo,
  VsaCustomer,
  VsaEmail,
  VsaEmailTemplate,
  VsaOrder,
  VsaProduct,
  VsaTask,
  VsaTaskStats,
  Warehouse,
} from '@/lib/types';

const API_BASE = '/api';

async function request<T>(
  path: string,
  options: RequestInit & { method?: string; body?: unknown } = {}
): Promise<T> {
  const { method = 'GET', body, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...rest.headers,
    },
    credentials: 'include',
  };
  if (body !== undefined && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const message = (errBody.detail ?? res.statusText) as string;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

// --- Config / user ---

export async function fetchUserInfo(): Promise<UserInfo> {
  return request<UserInfo>('/me');
}

// --- Projects ---

export async function fetchProjects(): Promise<Project[]> {
  return request<Project[]>('/projects');
}

export async function fetchProject(projectId: string): Promise<Project> {
  return request<Project>(`/projects/${projectId}`);
}

export async function createProject(name: string): Promise<Project> {
  return request<Project>('/projects', { method: 'POST', body: { name } });
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  return request(`/projects/${projectId}`, { method: 'PATCH', body: { name } });
}

export async function deleteProject(projectId: string): Promise<void> {
  return request(`/projects/${projectId}`, { method: 'DELETE' });
}

// --- Conversations ---

export async function fetchConversations(projectId: string): Promise<Conversation[]> {
  return request<Conversation[]>(`/projects/${projectId}/conversations`);
}

export async function fetchConversation(
  projectId: string,
  conversationId: string
): Promise<Conversation> {
  return request<Conversation>(`/projects/${projectId}/conversations/${conversationId}`);
}

export async function createConversation(
  projectId: string,
  title: string = 'New Conversation'
): Promise<Conversation> {
  return request<Conversation>(`/projects/${projectId}/conversations`, {
    method: 'POST',
    body: { title },
  });
}

export async function deleteConversation(
  projectId: string,
  conversationId: string
): Promise<void> {
  return request(`/projects/${projectId}/conversations/${conversationId}`, {
    method: 'DELETE',
  });
}

// --- Clusters & warehouses ---

export async function fetchClusters(): Promise<Cluster[]> {
  return request<Cluster[]>('/clusters');
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  return request<Warehouse[]>('/warehouses');
}

// --- Agent (invoke + streaming) ---

export interface InvokeAgentParams {
  projectId: string;
  conversationId?: string | null;
  message: string;
  clusterId?: string | null;
  defaultCatalog?: string | null;
  defaultSchema?: string | null;
  warehouseId?: string | null;
  workspaceFolder?: string | null;
  mlflowExperimentName?: string | null;
  signal?: AbortSignal;
  onEvent: (event: Record<string, unknown>) => void;
  onError: (error: Error) => void;
  onDone: () => void | Promise<void>;
  onExecutionId?: (executionId: string) => void;
}

export async function invokeAgent(params: InvokeAgentParams): Promise<void> {
  const {
    projectId,
    conversationId,
    message,
    clusterId,
    defaultCatalog,
    defaultSchema,
    warehouseId,
    workspaceFolder,
    mlflowExperimentName,
    signal,
    onEvent,
    onError,
    onDone,
    onExecutionId,
  } = params;

  const res = await request<{ execution_id: string; conversation_id: string }>('/invoke_agent', {
    method: 'POST',
    body: {
      project_id: projectId,
      conversation_id: conversationId ?? null,
      message,
      cluster_id: clusterId ?? null,
      default_catalog: defaultCatalog ?? null,
      default_schema: defaultSchema ?? null,
      warehouse_id: warehouseId ?? null,
      workspace_folder: workspaceFolder ?? null,
      mlflow_experiment_name: mlflowExperimentName ?? null,
    },
  });

  onExecutionId?.(res.execution_id);

  await streamProgress({
    executionId: res.execution_id,
    lastEventTimestamp: undefined,
    signal,
    onEvent,
    onError,
    onDone,
  });
}

export interface ReconnectToExecutionParams {
  executionId: string;
  storedEvents: unknown[];
  signal?: AbortSignal;
  onEvent: (event: Record<string, unknown>) => void;
  onError: (error: Error) => void;
  onDone: () => void | Promise<void>;
}

export async function reconnectToExecution(params: ReconnectToExecutionParams): Promise<void> {
  const { executionId, storedEvents, signal, onEvent, onError, onDone } = params;

  for (const ev of storedEvents) {
    const e = ev as Record<string, unknown>;
    if (e && typeof e === 'object' && e.type !== undefined) {
      onEvent(e);
    }
  }

  let lastTimestamp: number | undefined;
  const lastEv = storedEvents[storedEvents.length - 1] as Record<string, unknown> | undefined;
  if (lastEv && typeof lastEv === 'object' && lastEv.timestamp != null) {
    lastTimestamp = Number(lastEv.timestamp);
  }

  await streamProgress({
    executionId,
    lastEventTimestamp: lastTimestamp,
    signal,
    onEvent,
    onError,
    onDone,
  });
}

async function streamProgress(params: {
  executionId: string;
  lastEventTimestamp?: number;
  signal?: AbortSignal;
  onEvent: (event: Record<string, unknown>) => void;
  onError: (error: Error) => void;
  onDone: () => void | Promise<void>;
}): Promise<void> {
  const {
    executionId,
    lastEventTimestamp,
    signal,
    onEvent,
    onError,
    onDone,
  } = params;

  let lastTs: number = lastEventTimestamp ?? 0;

  while (true) {
    if (signal?.aborted) return;

    let shouldReconnect = false;

    try {
      const res = await fetch(`${API_BASE}/stream_progress/${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ last_event_timestamp: lastTs }),
        signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const message = (errBody.detail ?? res.statusText) as string;
        onError(new Error(typeof message === 'string' ? message : JSON.stringify(message)));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError(new Error('No response body'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (signal?.aborted) return;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            await onDone();
            return;
          }
          try {
            const event = JSON.parse(payload) as Record<string, unknown>;
            if (event.type === 'stream.reconnect') {
              lastTs = Number(event.last_timestamp) ?? lastTs;
              shouldReconnect = true;
              break;
            }
            if (event.type === 'stream.completed') {
              await onDone();
              return;
            }
            onEvent(event);
          } catch {
            // skip malformed
          }
        }
        if (shouldReconnect) break;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      onError(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    if (!shouldReconnect) {
      await onDone();
      return;
    }
  }
}

// --- Stop execution ---

export async function stopExecution(executionId: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/stop_stream/${executionId}`, {
    method: 'POST',
  });
}

// --- Executions ---

export async function fetchExecutions(
  projectId: string,
  conversationId: string
): Promise<{ active: Execution | null; recent: Execution[] }> {
  const data = await request<{
    active: Execution | null;
    recent: Execution[];
  }>(`/projects/${projectId}/conversations/${conversationId}/executions`);
  return data;
}

// --- Skills ---

export interface SkillTreeNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: SkillTreeNode[];
}

export interface FetchSystemPromptParams {
  clusterId?: string | null;
  warehouseId?: string | null;
  defaultCatalog?: string | null;
  defaultSchema?: string | null;
  workspaceFolder?: string | null;
  projectId?: string | null;
}

export async function fetchSkillsTree(projectId: string): Promise<SkillTreeNode[]> {
  const data = await request<{ tree: SkillTreeNode[] }>(
    `/projects/${projectId}/skills/tree`
  );
  return data.tree ?? [];
}

export async function fetchSkillFile(
  projectId: string,
  path: string
): Promise<{ content: string; path?: string; filename?: string }> {
  const data = await request<{ content: string; path?: string; filename?: string }>(
    `/projects/${projectId}/skills/file?path=${encodeURIComponent(path)}`
  );
  return data;
}

export async function fetchSystemPrompt(params: FetchSystemPromptParams): Promise<string> {
  const q = new URLSearchParams();
  if (params.clusterId != null) q.set('cluster_id', params.clusterId);
  if (params.warehouseId != null) q.set('warehouse_id', params.warehouseId);
  if (params.defaultCatalog != null) q.set('default_catalog', params.defaultCatalog);
  if (params.defaultSchema != null) q.set('default_schema', params.defaultSchema);
  if (params.workspaceFolder != null) q.set('workspace_folder', params.workspaceFolder);
  if (params.projectId != null) q.set('project_id', params.projectId);
  const data = await request<{ system_prompt: string }>(`/config/system_prompt?${q.toString()}`);
  return data.system_prompt ?? '';
}

export async function fetchAvailableSkills(
  projectId: string
): Promise<{ skills: { name: string; description: string; enabled: boolean }[]; all_enabled: boolean; enabled_count: number; total_count: number }> {
  return request(`/projects/${projectId}/skills/available`);
}

export async function updateEnabledSkills(
  projectId: string,
  enabledSkills: string[] | null
): Promise<void> {
  await request(`/projects/${projectId}/skills/enabled`, {
    method: 'PUT',
    body: { enabled_skills: enabledSkills },
  });
}

export async function reloadProjectSkills(projectId: string): Promise<void> {
  await request(`/projects/${projectId}/skills/reload`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Virtual Service Assistant API
// ---------------------------------------------------------------------------

// Products
export async function fetchVsaProducts(): Promise<VsaProduct[]> {
  return request<VsaProduct[]>('/vsa/products');
}
export async function createVsaProduct(data: Omit<VsaProduct, 'id' | 'created_at'>): Promise<VsaProduct> {
  return request<VsaProduct>('/vsa/products', { method: 'POST', body: data });
}
export async function updateVsaProduct(id: string, data: Omit<VsaProduct, 'id' | 'created_at'>): Promise<VsaProduct> {
  return request<VsaProduct>(`/vsa/products/${id}`, { method: 'PATCH', body: data });
}
export async function deleteVsaProduct(id: string): Promise<void> {
  return request(`/vsa/products/${id}`, { method: 'DELETE' });
}

// Customers
export async function fetchVsaCustomers(): Promise<VsaCustomer[]> {
  return request<VsaCustomer[]>('/vsa/customers');
}
export async function lookupVsaCustomer(email: string): Promise<{ found: boolean; customer: VsaCustomer | null }> {
  return request(`/vsa/customers/lookup?email=${encodeURIComponent(email)}`);
}
export async function createVsaCustomer(data: Omit<VsaCustomer, 'id' | 'created_at'>): Promise<VsaCustomer> {
  return request<VsaCustomer>('/vsa/customers', { method: 'POST', body: data });
}
export async function updateVsaCustomer(id: string, data: Omit<VsaCustomer, 'id' | 'created_at'>): Promise<VsaCustomer> {
  return request<VsaCustomer>(`/vsa/customers/${id}`, { method: 'PATCH', body: data });
}
export async function deleteVsaCustomer(id: string): Promise<void> {
  return request(`/vsa/customers/${id}`, { method: 'DELETE' });
}

// Email templates
export async function fetchVsaTemplates(): Promise<VsaEmailTemplate[]> {
  return request<VsaEmailTemplate[]>('/vsa/templates');
}
export async function createVsaTemplate(data: Omit<VsaEmailTemplate, 'id' | 'created_at'>): Promise<VsaEmailTemplate> {
  return request<VsaEmailTemplate>('/vsa/templates', { method: 'POST', body: data });
}
export async function updateVsaTemplate(id: string, data: Omit<VsaEmailTemplate, 'id' | 'created_at'>): Promise<VsaEmailTemplate> {
  return request<VsaEmailTemplate>(`/vsa/templates/${id}`, { method: 'PATCH', body: data });
}
export async function deleteVsaTemplate(id: string): Promise<void> {
  return request(`/vsa/templates/${id}`, { method: 'DELETE' });
}

// Emails
export async function fetchVsaEmails(): Promise<VsaEmail[]> {
  return request<VsaEmail[]>('/vsa/emails');
}
export async function createVsaEmail(data: {
  sender_name?: string | null;
  sender_email: string;
  subject: string;
  body: string;
}): Promise<VsaEmail> {
  return request<VsaEmail>('/vsa/emails', { method: 'POST', body: data });
}
export async function createVsaEmailFromTemplate(templateId: string): Promise<VsaEmail> {
  return request<VsaEmail>(`/vsa/emails/from-template/${templateId}`, { method: 'POST' });
}
export async function classifyVsaEmail(emailId: string): Promise<VsaTask> {
  return request<VsaTask>(`/vsa/emails/${emailId}/classify`, { method: 'POST' });
}
export async function deleteVsaEmail(id: string): Promise<void> {
  return request(`/vsa/emails/${id}`, { method: 'DELETE' });
}

// Tasks
export async function fetchVsaTasks(params?: { status?: string; task_type?: string }): Promise<VsaTask[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.task_type) q.set('task_type', params.task_type);
  return request<VsaTask[]>(`/vsa/tasks${q.toString() ? '?' + q.toString() : ''}`);
}
export async function fetchVsaTaskStats(): Promise<VsaTaskStats> {
  return request<VsaTaskStats>('/vsa/tasks/stats');
}
export async function fetchVsaTask(id: string): Promise<VsaTask> {
  return request<VsaTask>(`/vsa/tasks/${id}`);
}
export async function updateVsaTask(
  id: string,
  data: {
    status?: string;
    draft_reply?: string;
    notes?: string;
    problem_summary?: string;
    solution_summary?: string;
  }
): Promise<VsaTask> {
  return request<VsaTask>(`/vsa/tasks/${id}`, { method: 'PATCH', body: data });
}
export async function regenerateVsaReply(id: string): Promise<VsaTask> {
  return request<VsaTask>(`/vsa/tasks/${id}/regenerate-reply`, { method: 'POST' });
}

// Orders
export async function createVsaOrder(data: {
  task_id: string;
  quantity: number;
  delivery_address?: string | null;
  notes?: string | null;
}): Promise<VsaOrder> {
  return request<VsaOrder>('/vsa/orders', { method: 'POST', body: data });
}
export async function updateVsaOrderStatus(id: string, status: string): Promise<VsaOrder> {
  return request<VsaOrder>(`/vsa/orders/${id}`, { method: 'PATCH', body: { status } });
}
