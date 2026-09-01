export interface PermissionItem {
  menu_id: number;
  menu_name: string;
  menu_path: string | null;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface UserMe {
  id: number;
  username: string;
  full_name: string;
  email: string;
  group_id: number | null;
  group_name: string | null;
  allowed_item_groups?: string | null;
  permissions: PermissionItem[];
}

export interface MenuNode {
  id: number;
  name: string;
  path: string | null;
  icon: string | null;
  sort_order: number;
  parent_id: number | null;
  is_active: boolean;
  children: MenuNode[];
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  telegram_chat_id?: string | null;
  group_id: number | null;
  group?: { id: number; name: string };
  allowed_item_groups?: string | null;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  allowed_item_groups?: string | null;
  is_active: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

export interface AuthMatrixCell {
  menu_id: number;
  menu_name: string;
  menu_path: string | null;
  parent_id: number | null;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface GroupMatrixRow {
  group_id: number;
  group_name: string;
  permissions: AuthMatrixCell[];
}

export interface SystemSetting {
  id: number;
  key: string;
  value: string | null;
  description: string | null;
  category: string;
  data_type: string;
  updated_at: string;
}

export interface SubItemResponse {
  id: number;
  po_item_id: number;
  estimate_date: string;
  quantity: number;
  updated_by_name: string | null;
  updated_by_type: string | null;
  updated_at: string;
}

export interface POItemAuditLogResponse {
  id: number;
  action: string;
  changes_detail: string;
  changed_by_name: string;
  changed_by_type: string;
  changed_at: string;
}

export interface POItemResponse {
  id: number;
  po_header_id: number;
  line_num?: number;
  po_number: string;
  po_date: string;
  supplier_code: string;
  supplier_name: string;
  buyer_name: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit: string;
  received_qty: number;
  remaining_qty: number;
  due_date?: string | null;
  item_group?: string | null;
  estimate_date: string | null;
  estimate_qty: number | null;
  allow_over_delivery?: boolean;
  status: string;
  is_new?: boolean;
  closed_at?: string | null;
  locked_by?: string | null;
  lock_expires_at?: string | null;
  updated_by_name: string | null;
  updated_by_type: string | null;
  updated_at: string;
  sub_items: SubItemResponse[];
  audit_logs: POItemAuditLogResponse[];
}

export interface ItemMaster {
  id: number;
  item_code: string;
  description: string;
  lead_time_days: number;
  notify_alert_days: number;
  item_group?: string | null;
  is_new: boolean;
  created_at?: string;
  updated_at: string;
}

export interface SupplierMaster {
  id: number;
  supplier_code: string;
  supplier_name: string;
  telephone: string | null;
  email: string | null;
  contact_person: string | null;
  is_new: boolean;
  allow_over_delivery?: boolean;
  last_sent_at?: string | null;
  updated_at: string;
}

export interface TransactionLogItem {
  id: number;
  category: string;
  action: string;
  status: string;
  message: string;
  details?: string | null;
  records_count: number;
  duration_ms: number;
  triggered_by: string;
  created_at: string;
}

export interface LogSummaryStats {
  total_logs: number;
  sap_sync_count: number;
  email_sent_count: number;
  qms_export_count: number;
  portal_submits_count: number;
  errors_count: number;
}
