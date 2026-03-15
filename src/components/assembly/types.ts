export interface AssemblyTemplate {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  stages?: AssemblyTemplateStage[];
}

export interface AssemblyTemplateStage {
  id: string;
  template_id: string;
  name: string;
  description: string;
  stage_order: number;
  created_at: string;
  items?: AssemblyTemplateStageItem[];
}

export interface AssemblyTemplateStageItem {
  id: string;
  template_stage_id: string;
  item_type: 'material' | 'product' | 'equipment';
  item_name: string;
  quantity: number;
  unit: string;
  product_id: string | null;
  material_id: string | null;
  notes: string;
  created_at: string;
}

export interface AssemblyProject {
  id: string;
  name: string;
  quote_id: string | null;
  budget_id: string | null;
  customer_id: string | null;
  status: 'planning' | 'in_progress' | 'completed' | 'cancelled';
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  customer?: { name: string } | null;
  quote?: { quote_number: string; total_value: number } | null;
  budget?: { title: string; grand_total: number } | null;
  stages?: AssemblyStage[];
}

export interface AssemblyStage {
  id: string;
  assembly_project_id: string;
  template_stage_id: string | null;
  name: string;
  description: string;
  stage_order: number;
  status: 'pending' | 'in_progress' | 'completed';
  planned_date: string | null;
  completed_date: string | null;
  responsible: string;
  notes: string;
  created_at: string;
  updated_at: string;
  items?: AssemblyStageItem[];
}

export interface AssemblyStageItem {
  id: string;
  assembly_stage_id: string;
  item_type: 'material' | 'product' | 'equipment' | 'composition';
  item_name: string;
  quantity: number;
  unit: string;
  product_id: string | null;
  material_id: string | null;
  composition_id: string | null;
  status: 'pending' | 'available' | 'sent' | 'used';
  sent_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}
