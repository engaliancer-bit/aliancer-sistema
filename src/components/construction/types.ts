export type BudgetType = 'residencial' | 'comercial' | 'industrial' | 'rural' | 'pavimentacao';
export type BudgetStatus = 'rascunho' | 'em_andamento' | 'aprovado' | 'fechado' | 'cancelado';
export type MeasurementStatus = 'pendente' | 'sugerido' | 'confirmado' | 'ignorado';
export type ElementSource = 'manual' | 'planta_ia';
export type ItemType = 'composicao' | 'material' | 'produto' | 'servico';

export interface Budget {
  id: string;
  customer_id: string | null;
  title: string;
  description: string | null;
  type: BudgetType;
  status: BudgetStatus;
  currency: string;
  bdi_percent: number;
  total_materials: number;
  total_labor: number;
  total_equipment: number;
  total_indirect: number;
  total_bdi: number;
  grand_total: number;
  validity_days: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customers?: { id: string; name: string; phone: string };
}

export interface WBSStep {
  id: string;
  budget_id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  total_value: number;
  is_parametric: boolean;
}

export interface SubEtapa {
  name: string;
  elements: BudgetElement[];
}

export interface BudgetElement {
  id: string;
  budget_id: string;
  wbs_step_id: string | null;
  sub_etapa: string | null;
  element_type: string;
  label: string;
  params: Record<string, number | string>;
  calculated_quantity: number;
  calculated_unit: string;
  calc_summary: string | null;
  measurement_status: MeasurementStatus;
  source: ElementSource;
  notes: string | null;
  survey_notes: string | null;
  created_at: string;
  room: string | null;
  foundation_param_id: string | null;
}

export interface BudgetItem {
  id: string;
  budget_id: string;
  wbs_step_id: string | null;
  element_id: string | null;
  composition_id: string | null;
  item_type: ItemType;
  material_id: string | null;
  product_id: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  bdi_value: number;
  final_price: number;
  notes: string | null;
  sort_order: number;
}

export interface Composition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  element_type: string | null;
  base_source: string | null;
}

export interface CompositionItem {
  id: string;
  composition_id: string;
  item_type: 'material' | 'produto' | 'mao_de_obra' | 'equipamento';
  material_id: string | null;
  product_id: string | null;
  description: string | null;
  unit: string;
  coefficient: number;
  unit_price: number;
  materials?: { id: string; name: string; unit: string; resale_price: number | null; unit_cost: number | null };
  products?: { id: string; name: string; unit: string; sale_price: number; final_sale_price: number | null };
}

export interface MaterialItem {
  id: string;
  name: string;
  unit: string;
  resale_price: number | null;
  unit_cost: number | null;
}

export interface ProductItem {
  id: string;
  name: string;
  unit: string;
  sale_price: number;
  final_sale_price: number | null;
}

export interface CalculationLog {
  id: string;
  budget_id: string;
  element_id: string | null;
  item_id: string | null;
  calculation_type: string;
  input_params: Record<string, any>;
  formula: string | null;
  result_value: number | null;
  result_unit: string | null;
  notes: string | null;
  created_at: string;
}

export interface BudgetGlobalParam {
  id: string;
  budget_id: string;
  param_key: string;
  param_label: string;
  param_category: string;
  material_id: string | null;
  recipe_id: string | null;
  unit_price: number;
  value_text: string | null;
  notes: string | null;
  sort_order: number;
  materials?: { id: string; name: string; unit: string; resale_price: number | null; unit_cost: number | null };
  recipes?: { id: string; name: string; concrete_type: string | null; specific_weight: number | null };
}

export type FoundationParamType = 'sapata' | 'baldrame' | 'pilar_fundacao' | 'alicerce' | 'estaca' | 'tubulao' | 'pilar' | 'viga_cinta' | 'verga';

export const FOUNDATION_TYPES: { value: FoundationParamType; label: string; elementType: string }[] = [
  { value: 'sapata',         label: 'Sapata Isolada',        elementType: 'sapata' },
  { value: 'baldrame',       label: 'Viga Baldrame',          elementType: 'baldrame' },
  { value: 'pilar_fundacao', label: 'Pilar de Fundacao',     elementType: 'pilar_fundacao' },
  { value: 'alicerce',       label: 'Alicerce',              elementType: 'alicerce' },
  { value: 'estaca',         label: 'Estaca',                elementType: 'estaca' },
  { value: 'tubulao',        label: 'Tubulao',               elementType: 'tubulao' },
  { value: 'pilar',          label: 'Pilar Estrutural',      elementType: 'pilar' },
  { value: 'viga_cinta',     label: 'Viga Cinta',            elementType: 'viga_cinta' },
  { value: 'verga',          label: 'Verga / Contraverga',   elementType: 'verga' },
];

export type ReinforcementType = 'malha' | 'viga' | 'coluna';

export interface ReinforcementBar {
  material_id: string;
  material_name: string;
  unit: string;
  package_size: number;
  resale_price: number;
  meters_used: number;
  reinforcement_type?: ReinforcementType;
  spacing_x?: number;
  spacing_y?: number;
  hook_length_cm?: number;
  long_material_id?: string;
  long_material_name?: string;
  long_material_unit?: string;
  long_material_pkg?: number;
  long_material_price?: number;
  long_bars_qty?: number;
  trans_material_id?: string;
  trans_material_name?: string;
  trans_material_unit?: string;
  trans_material_pkg?: number;
  trans_material_price?: number;
  trans_spacing_cm?: number;
  wire_material_id?: string;
  wire_material_name?: string;
  wire_material_unit?: string;
  wire_material_pkg?: number;
  wire_material_price?: number;
  wire_per_node_m?: number;
}

export interface CaixariaItem {
  material_id: string;
  material_name: string;
  unit: string;
  package_size: number;
  resale_price: number;
  quantity_per_unit: number;
}

export interface FoundationDimensions {
  largura?: number;
  comprimento?: number;
  altura?: number;
  cobrimento?: number;
  espessura_parede?: number;
  tipo_material?: string;
  espessura?: number;
  diametro?: number;
  comprimento_total?: number;
  reinforcement_bars?: ReinforcementBar[];
  caixaria_items?: CaixariaItem[];
}

export interface BudgetFoundationParam {
  id: string;
  budget_id: string;
  param_type: FoundationParamType;
  code: string;
  label: string;
  dimensions: FoundationDimensions;
  recipe_id: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  recipes?: { id: string; name: string; concrete_type: string | null; specific_weight: number | null };
}

export interface RecipeItemWithMaterial {
  id: string;
  recipe_id: string;
  material_id: string | null;
  quantity: number;
  materials?: {
    id: string;
    name: string;
    unit: string;
    resale_price: number | null;
    unit_cost: number | null;
    package_size: number | null;
  };
}

export interface CaixariaRule {
  min_height: number;
  board_width_cm: number;
}

export interface BudgetCaixariaSettings {
  id: string;
  budget_id: string;
  board_length_m: number;
  board_width_rule: CaixariaRule[];
  waste_percent: number;
  nail_kg_per_m2: number;
  wire_gravateamento_m_per_ml: number;
  nail_price_per_kg: number;
  board_price_per_unit: number;
  notes: string | null;
}

export const ELEMENT_DEFS: {
  value: string;
  label: string;
  category: string;
  params: { key: string; label: string; unit: string; step?: number; default?: number }[];
  hint?: string;
}[] = [
  // SERVICOS PRELIMINARES
  {
    value: 'canteiro_obras', label: 'Canteiro de Obras', category: 'servicos_preliminares',
    params: [
      { key: 'area', label: 'Area (m2)', unit: 'm2', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m2)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Custo total: area × custo unitario'
  },
  {
    value: 'instalacoes_provisorias', label: 'Instalacoes Provisorias', category: 'servicos_preliminares',
    params: [
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Custo total: qtd × custo unitario'
  },
  {
    value: 'tapume', label: 'Tapume / Fechamento', category: 'servicos_preliminares',
    params: [
      { key: 'comprimento', label: 'Comprimento (m)', unit: 'm', step: 0.5, default: 0 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Custo total: comprimento × custo unitario'
  },
  {
    value: 'locacao_terreno', label: 'Locacao e Marcacao', category: 'servicos_preliminares',
    params: [
      { key: 'area', label: 'Area (m2)', unit: 'm2', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m2)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Custo total: area × custo unitario'
  },
  {
    value: 'limpeza_terreno', label: 'Limpeza do Terreno', category: 'servicos_preliminares',
    params: [
      { key: 'area', label: 'Area (m2)', unit: 'm2', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m2)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Custo total: area × custo unitario'
  },
  // FUNDACOES
  {
    value: 'sapata', label: 'Sapata Isolada', category: 'fundacao',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.05 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 0.05 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.05 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.05 },
      { key: 'arm_gancho', label: 'Comprimento do Gancho', unit: 'cm', step: 1, default: 5 },
      { key: 'arm_long_diametro', label: 'Malha: Diametro (ex: CA-50 8mm)', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_malha_espacamento', label: 'Malha: Espacamento entre barras', unit: 'cm', step: 1, default: 10 },
    ],
    hint: 'Volume concreto: b × l × h × qtd. Informe as dimensoes, cobrimento, gancho e espacamento — o sistema calcula automaticamente o numero de barras, comprimento de cada barra e os pontos de amarracao. Arame recozido calculado automaticamente (0,0027 kg/ponto).'
  },
  {
    value: 'bloco_fundacao', label: 'Bloco de Fundacao', category: 'fundacao',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.05 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 0.05 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.05 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.05 },
      { key: 'arm_long_diametro', label: 'Arm. Long.: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_long_qtd_b', label: 'Arm. Long.: Barras em b', unit: 'un', step: 1, default: 0 },
      { key: 'arm_long_qtd_l', label: 'Arm. Long.: Barras em l', unit: 'un', step: 1, default: 0 },
    ],
    hint: 'Volume concreto: b × l × h × qtd. Armadura longitudinal em duas direcoes.'
  },
  {
    value: 'baldrame', label: 'Viga Baldrame', category: 'fundacao',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.05 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.05 },
      { key: 'comprimento', label: 'Comprimento total (L)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.03 },
      { key: 'arm_gancho', label: 'Comprimento do Gancho (estribo)', unit: 'cm', step: 1, default: 10 },
      { key: 'arm_long_diametro', label: 'Arm. Long.: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_long_qtd', label: 'Arm. Long.: Qtd de barras', unit: 'un', step: 1, default: 0 },
      { key: 'arm_trans_diametro', label: 'Arm. Trans. (Estribo): Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_trans_espacamento', label: 'Arm. Trans. (Estribo): Espacamento', unit: 'm', step: 0.01, default: 0.2 },
    ],
    hint: 'Volume concreto: b × h × L × qtd. Informe o comprimento total ou use trechos individuais. Arame recozido calculado automaticamente (0,0028 kg/ponto de amarracao). Em 1m de viga com 6 barras long. e estribos a cada 0,20m = 30 pontos = 0,084 kg de arame/m.'
  },
  {
    value: 'radier', label: 'Radier / Placa de Fundo', category: 'fundacao',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.1 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 0.1 },
      { key: 'espessura', label: 'Espessura (e)', unit: 'm', step: 0.01 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.03 },
      { key: 'arm_diametro', label: 'Arm.: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_espacamento', label: 'Arm.: Espacamento malha', unit: 'm', step: 0.01, default: 0.2 },
    ],
    hint: 'Volume: b × l × e. Armadura em malha nos dois sentidos.'
  },
  {
    value: 'estaca', label: 'Estaca', category: 'fundacao',
    params: [
      { key: 'diametro', label: 'Diametro (d)', unit: 'm', step: 0.05 },
      { key: 'altura', label: 'Comprimento (h)', unit: 'm', step: 0.5 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.05 },
      { key: 'arm_long_diametro', label: 'Arm. Long.: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_long_qtd', label: 'Arm. Long.: Qtd de barras', unit: 'un', step: 1, default: 0 },
      { key: 'arm_trans_diametro', label: 'Arm. Transversal: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_trans_espacamento', label: 'Arm. Transversal: Espacamento', unit: 'm', step: 0.01, default: 0.2 },
    ],
    hint: 'Volume: π × (d/2)² × h × qtd. Espiral/estribo calculada com cobrimento.'
  },
  {
    value: 'alicerce', label: 'Alicerce (Alvenaria)', category: 'fundacao',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.05, default: 0.5 },
      { key: 'altura', label: 'Altura/Profundidade (h)', unit: 'm', step: 0.05, default: 0.4 },
      { key: 'comprimento', label: 'Comprimento total (L)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade de trechos', unit: 'un', step: 1, default: 1 },
      { key: 'espessura_junta', label: 'Espessura da junta (cm)', unit: 'cm', step: 0.5, default: 1.5 },
    ],
    hint: 'Volume: b × h × L × qtd. Fundacao em alvenaria de pedra ou bloco. Calcula consumo de material e argamassa de assentamento.'
  },
  {
    value: 'pilar_fundacao', label: 'Pilar de Fundacao', category: 'fundacao',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.01 },
      { key: 'comprimento', label: 'Profundidade (l)', unit: 'm', step: 0.01 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.04 },
      { key: 'arm_long_diametro', label: 'Arm. Long.: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_long_qtd', label: 'Arm. Long.: Qtd de barras', unit: 'un', step: 1, default: 0 },
      { key: 'arm_trans_diametro', label: 'Arm. Trans. (Estribo): Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_trans_espacamento', label: 'Arm. Trans. (Estribo): Espacamento', unit: 'm', step: 0.01, default: 0.2 },
    ],
    hint: 'Pilar enterrado abaixo do nivel do baldrame. Volume: b × l × h × qtd. Mesma logica de armadura do pilar estrutural, com cobrimento maior (4cm).'
  },
  {
    value: 'tubulao', label: 'Tubulao', category: 'fundacao',
    params: [
      { key: 'diametro', label: 'Diametro do fuste (d)', unit: 'm', step: 0.05 },
      { key: 'altura', label: 'Comprimento total (h)', unit: 'm', step: 0.5 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.05 },
      { key: 'arm_long_diametro', label: 'Arm. Long.: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_long_qtd', label: 'Arm. Long.: Qtd de barras', unit: 'un', step: 1, default: 0 },
      { key: 'arm_trans_diametro', label: 'Arm. Transversal: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_trans_espacamento', label: 'Arm. Transversal: Espacamento', unit: 'm', step: 0.01, default: 0.2 },
    ],
    hint: 'Volume: π × (d/2)² × h × qtd. Fundacao profunda escavada manualmente ou mecanicamente.'
  },
  // ESTRUTURA
  {
    value: 'viga', label: 'Viga', category: 'estrutura',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.01 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.01 },
      { key: 'comprimento', label: 'Comprimento (L)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.025 },
      { key: 'arm_long_diametro', label: 'Arm. Long.: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_long_qtd_inf', label: 'Arm. Long.: Barras inferiores', unit: 'un', step: 1, default: 0 },
      { key: 'arm_long_qtd_sup', label: 'Arm. Long.: Barras superiores', unit: 'un', step: 1, default: 0 },
      { key: 'arm_trans_diametro', label: 'Arm. Trans. (Estribo): Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_trans_espacamento', label: 'Arm. Trans. (Estribo): Espacamento', unit: 'm', step: 0.01, default: 0.15 },
    ],
    hint: 'Volume: b × h × L × qtd. Estribo fechado: perimetro = 2×(b-2c) + 2×(h-2c) + ganchos. Qtd = L/espacamento.'
  },
  {
    value: 'pilar', label: 'Pilar', category: 'estrutura',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.01 },
      { key: 'comprimento', label: 'Profundidade (l)', unit: 'm', step: 0.01 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.025 },
      { key: 'arm_long_diametro', label: 'Arm. Long.: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_long_qtd', label: 'Arm. Long.: Qtd de barras', unit: 'un', step: 1, default: 0 },
      { key: 'arm_trans_diametro', label: 'Arm. Trans. (Estribo): Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_trans_espacamento', label: 'Arm. Trans. (Estribo): Espacamento', unit: 'm', step: 0.01, default: 0.15 },
    ],
    hint: 'Volume: b × l × h × qtd. Estribo fechado: perimetro = 2×(b-2c) + 2×(l-2c) + ganchos. Qtd estribos = h/espacamento.'
  },
  {
    value: 'laje', label: 'Laje', category: 'estrutura',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.1 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 0.1 },
      { key: 'espessura', label: 'Espessura (e)', unit: 'm', step: 0.005 },
      { key: 'cobrimento', label: 'Cobrimento (c)', unit: 'm', step: 0.005, default: 0.02 },
      { key: 'arm_diametro', label: 'Arm.: Diametro', unit: 'mm', step: 1, default: 0 },
      { key: 'arm_espacamento', label: 'Arm.: Espacamento malha', unit: 'm', step: 0.025, default: 0.15 },
    ],
    hint: 'Area: b × l | Volume: b × l × e. Armadura em malha cruzada. Qtd barras em b = l/esp; em l = b/esp.'
  },
  {
    value: 'escada', label: 'Escada', category: 'estrutura',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.1 },
      { key: 'comprimento', label: 'Comprimento inclinado (l)', unit: 'm', step: 0.1 },
    ],
    hint: 'Area inclinada: b × l'
  },
  // VEDACAO
  {
    value: 'parede_alvenaria', label: 'Parede de Alvenaria', category: 'vedacao',
    params: [
      { key: 'comprimento', label: 'Comprimento (L)', unit: 'm', step: 0.1 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'area_deducao', label: 'Deducao de aberturas', unit: 'm2', step: 0.1, default: 0 },
    ],
    hint: 'Area: L × h × qtd - deducoes. Informe a area total de portas e janelas no campo Deducao.'
  },
  {
    value: 'parede_drywall', label: 'Parede Drywall', category: 'vedacao',
    params: [
      { key: 'comprimento', label: 'Comprimento (L)', unit: 'm', step: 0.1 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'area_deducao', label: 'Deducao de aberturas', unit: 'm2', step: 0.1, default: 0 },
    ],
    hint: 'Area: L × h × qtd - deducoes'
  },
  {
    value: 'muro', label: 'Muro', category: 'vedacao',
    params: [
      { key: 'comprimento', label: 'Comprimento (L)', unit: 'm', step: 0.5 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
    ],
    hint: 'Area: L × h × qtd'
  },
  // ABERTURAS
  {
    value: 'porta', label: 'Porta', category: 'esquadria',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.05 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.05 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Area (para desconto em paredes): b × h × qtd'
  },
  {
    value: 'janela', label: 'Janela', category: 'esquadria',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.05 },
      { key: 'altura', label: 'Altura (h)', unit: 'm', step: 0.05 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Area (para desconto em paredes): b × h × qtd'
  },
  // REVESTIMENTOS
  {
    value: 'revestimento_piso', label: 'Piso (Ceramica / Porcelanato)', category: 'revestimento',
    params: [
      { key: 'largura', label: 'Largura do ambiente (b)', unit: 'm', step: 0.1 },
      { key: 'comprimento', label: 'Comprimento do ambiente (l)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade de ambientes', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m2)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Area total: b × l × qtd'
  },
  {
    value: 'revestimento_parede', label: 'Revestimento de Parede', category: 'revestimento',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.1 },
      { key: 'comprimento', label: 'Altura (l)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m2)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Area: b × l × qtd'
  },
  {
    value: 'revestimento_teto', label: 'Forro / Teto', category: 'revestimento',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.1 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m2)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Area: b × l × qtd'
  },
  // COBERTURA
  {
    value: 'cobertura', label: 'Cobertura', category: 'cobertura',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.1 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 0.1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m2)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Area projetada: b × l'
  },
  {
    value: 'impermeabilizacao', label: 'Impermeabilizacao', category: 'cobertura',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.1 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 0.1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m2)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Area: b × l'
  },
  // PINTURA
  {
    value: 'pintura', label: 'Pintura', category: 'acabamento',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.1 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 0.1 },
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/m2)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Area: b × l × qtd'
  },
  // LOUCAS E METAIS
  {
    value: 'bacia_sanitaria', label: 'Bacia Sanitaria', category: 'loucas_metais',
    params: [
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Informe o ambiente (ex: Banheiro Social, Suite). Custo: qtd × custo unitario'
  },
  {
    value: 'pia_cozinha', label: 'Pia de Cozinha', category: 'loucas_metais',
    params: [
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Informe o ambiente (ex: Cozinha, Area de Servico). Custo: qtd × custo unitario'
  },
  {
    value: 'lavatorio_cuba', label: 'Lavatorio / Cuba', category: 'loucas_metais',
    params: [
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Informe o ambiente. Custo: qtd × custo unitario'
  },
  {
    value: 'torneira_registro', label: 'Torneira / Registro', category: 'loucas_metais',
    params: [
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Informe o ambiente. Custo: qtd × custo unitario'
  },
  {
    value: 'chuveiro_ducha', label: 'Chuveiro / Ducha', category: 'loucas_metais',
    params: [
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Informe o ambiente. Custo: qtd × custo unitario'
  },
  {
    value: 'tanque_lavanderia', label: 'Tanque de Lavanderia', category: 'loucas_metais',
    params: [
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Informe o ambiente. Custo: qtd × custo unitario'
  },
  {
    value: 'item_louca_metal', label: 'Louca / Metal Avulso', category: 'loucas_metais',
    params: [
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Informe o ambiente e o item. Custo: qtd × custo unitario'
  },
  // PAVIMENTACAO
  {
    value: 'pavimentacao_asfalto', label: 'Pavimentacao Asfaltica', category: 'pavimentacao',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.5 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 1 },
      { key: 'espessura', label: 'Espessura (e)', unit: 'm', step: 0.01 },
    ],
    hint: 'Area: b × l | Vol: b × l × e'
  },
  {
    value: 'pavimentacao_concreto', label: 'Pavimentacao em Concreto', category: 'pavimentacao',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.5 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 1 },
      { key: 'espessura', label: 'Espessura (e)', unit: 'm', step: 0.01 },
    ],
    hint: 'Area: b × l | Vol: b × l × e'
  },
  {
    value: 'pavimentacao_intertravado', label: 'Piso Intertravado (Bloquete)', category: 'pavimentacao',
    params: [
      { key: 'largura', label: 'Largura (b)', unit: 'm', step: 0.5 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 1 },
      { key: 'espessura', label: 'Espessura (e)', unit: 'm', step: 0.005 },
    ],
    hint: 'Area: b × l'
  },
  // TERRA
  {
    value: 'terraplanagem', label: 'Corte / Aterro', category: 'terraplagem',
    params: [
      { key: 'largura', label: 'Largura media (b)', unit: 'm', step: 1 },
      { key: 'comprimento', label: 'Comprimento (l)', unit: 'm', step: 1 },
      { key: 'altura', label: 'Profundidade media (h)', unit: 'm', step: 0.1 },
    ],
    hint: 'Volume: b × l × h'
  },
  {
    value: 'drenagem', label: 'Drenagem (tubulacao)', category: 'drenagem',
    params: [
      { key: 'comprimento', label: 'Comprimento (L)', unit: 'm', step: 1 },
      { key: 'quantidade', label: 'Linhas', unit: 'un', step: 1, default: 1 },
    ],
    hint: 'Metro linear: L × qtd'
  },
  // INSTALACOES
  {
    value: 'instalacao_eletrica', label: 'Instalacao Eletrica', category: 'instalacao',
    params: [
      { key: 'quantidade', label: 'Pontos', unit: 'pt', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/pt)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Numero de pontos eletricos'
  },
  {
    value: 'instalacao_hidraulica', label: 'Instalacao Hidraulica', category: 'instalacao',
    params: [
      { key: 'quantidade', label: 'Pontos', unit: 'pt', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/pt)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Numero de pontos hidraulicos'
  },
  {
    value: 'instalacao_gas', label: 'Instalacao de Gas', category: 'instalacao',
    params: [
      { key: 'quantidade', label: 'Pontos', unit: 'pt', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unit. (R$/pt)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Numero de pontos de gas'
  },
  // OUTROS
  {
    value: 'outros', label: 'Item Avulso', category: 'outros',
    params: [
      { key: 'quantidade', label: 'Quantidade', unit: 'un', step: 1, default: 1 },
      { key: 'custo_unitario', label: 'Custo Unitario (R$)', unit: 'R$', step: 0.01, default: 0 },
    ],
    hint: 'Item personalizado. Informe quantidade e custo unitario'
  },
];

export const ELEMENT_CATEGORIES: Record<string, { label: string; color: string; bg: string }> = {
  servicos_preliminares: { label: 'Servicos Preliminares', color: 'text-rose-700',   bg: 'bg-rose-100' },
  fundacao:     { label: 'Fundacoes',          color: 'text-amber-700',  bg: 'bg-amber-100' },
  estrutura:    { label: 'Estrutura',           color: 'text-blue-700',   bg: 'bg-blue-100' },
  vedacao:      { label: 'Vedacao',             color: 'text-green-700',  bg: 'bg-green-100' },
  esquadria:    { label: 'Esquadrias',          color: 'text-cyan-700',   bg: 'bg-cyan-100' },
  revestimento: { label: 'Revestimentos',       color: 'text-teal-700',   bg: 'bg-teal-100' },
  cobertura:    { label: 'Cobertura',           color: 'text-slate-700',  bg: 'bg-slate-100' },
  acabamento:   { label: 'Acabamento',          color: 'text-orange-700', bg: 'bg-orange-100' },
  loucas_metais:{ label: 'Loucas e Metais',     color: 'text-pink-700',   bg: 'bg-pink-100' },
  pavimentacao: { label: 'Pavimentacao',        color: 'text-stone-700',  bg: 'bg-stone-100' },
  terraplagem:  { label: 'Terraplanagem',       color: 'text-lime-700',   bg: 'bg-lime-100' },
  drenagem:     { label: 'Drenagem',            color: 'text-sky-700',    bg: 'bg-sky-100' },
  instalacao:   { label: 'Instalacoes',         color: 'text-yellow-700', bg: 'bg-yellow-100' },
  outros:       { label: 'Outros',              color: 'text-gray-700',   bg: 'bg-gray-100' },
};

export const BUDGET_TYPE_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  residencial:  { label: 'Residencial',   color: 'from-blue-500 to-blue-600',   border: 'border-blue-400' },
  comercial:    { label: 'Comercial',     color: 'from-green-500 to-green-600', border: 'border-green-400' },
  industrial:   { label: 'Industrial',   color: 'from-gray-500 to-gray-600',   border: 'border-gray-400' },
  rural:        { label: 'Rural',         color: 'from-amber-500 to-amber-600', border: 'border-amber-400' },
  pavimentacao: { label: 'Pavimentacao', color: 'from-slate-500 to-slate-600', border: 'border-slate-400' },
};

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho:    { label: 'Rascunho',     color: 'bg-gray-100 text-gray-700' },
  em_andamento:{ label: 'Em Andamento', color: 'bg-blue-100 text-blue-700' },
  aprovado:    { label: 'Aprovado',     color: 'bg-emerald-100 text-emerald-700' },
  fechado:     { label: 'Fechado',      color: 'bg-green-100 text-green-700' },
  cancelado:   { label: 'Cancelado',    color: 'bg-red-100 text-red-700' },
};

export const MEASUREMENT_STATUS_CONFIG: Record<MeasurementStatus, { label: string; color: string }> = {
  pendente:   { label: 'Pendente',   color: 'bg-gray-100 text-gray-600' },
  sugerido:   { label: 'Sugerido',   color: 'bg-blue-100 text-blue-700' },
  confirmado: { label: 'Confirmado', color: 'bg-green-100 text-green-700' },
  ignorado:   { label: 'Ignorado',   color: 'bg-red-100 text-red-600' },
};

export const WBS_CATEGORY_MAP: Record<string, string[]> = {
  'Servicos Preliminares': ['servicos_preliminares', 'outros'],
  'Movimento de Terra': ['terraplagem', 'outros'],
  'Fundacoes': ['fundacao'],
  'Estrutura': ['estrutura', 'outros'],
  'Alvenaria e Vedacoes': ['vedacao', 'outros'],
  'Cobertura': ['cobertura', 'outros'],
  'Instalacoes Eletricas': ['instalacao', 'outros'],
  'Instalacoes Hidraulicas': ['instalacao', 'outros'],
  'Revestimentos': ['revestimento', 'acabamento', 'outros'],
  'Pisos': ['revestimento', 'pavimentacao', 'acabamento', 'outros'],
  'Esquadrias': ['esquadria', 'outros'],
  'Vidros': ['esquadria', 'outros'],
  'Pintura': ['acabamento', 'outros'],
  'Loucas e Metais': ['loucas_metais', 'outros'],
  'Servicos Complementares': ['outros', 'servicos_preliminares'],
  'Fechamentos': ['vedacao', 'esquadria', 'outros'],
  'Terraplanagem': ['terraplagem', 'outros'],
  'Drenagem': ['drenagem', 'outros'],
  'Base e Sub-base': ['pavimentacao', 'outros'],
  'Pavimentacao': ['pavimentacao', 'outros'],
  'Sinalizacao': ['servicos_preliminares', 'outros'],
  'Obras de Arte Correntes': ['estrutura', 'drenagem', 'outros'],
};

export const GLOBAL_PARAM_PRESETS: {
  key: string;
  label: string;
  category: string;
  placeholder?: string;
}[] = [
  { key: 'traco_concreto_sapata',   label: 'Traco Concreto - Sapata',         category: 'concreto',        placeholder: 'ex: 1:2:3 (cim:areia:brita)' },
  { key: 'traco_concreto_baldrame', label: 'Traco Concreto - Viga Baldrame',  category: 'concreto',        placeholder: 'ex: 1:2:3' },
  { key: 'traco_concreto_pilar',    label: 'Traco Concreto - Pilar',          category: 'concreto',        placeholder: 'ex: 1:1.5:3' },
  { key: 'traco_concreto_laje',     label: 'Traco Concreto - Laje',           category: 'concreto',        placeholder: 'ex: 1:2:3' },
  { key: 'traco_concreto_viga',     label: 'Traco Concreto - Viga',           category: 'concreto',        placeholder: 'ex: 1:2:3' },
  { key: 'traco_argamassa_assentamento', label: 'Traco Argamassa - Assentamento', category: 'argamassa', placeholder: 'ex: 1:4 (cim:areia)' },
  { key: 'traco_argamassa_reboco',       label: 'Traco Argamassa - Reboco',       category: 'argamassa', placeholder: 'ex: 1:6 (cim:areia)' },
  { key: 'traco_argamassa_emboco',       label: 'Traco Argamassa - Emboco',       category: 'argamassa', placeholder: 'ex: 1:4 (cim:areia)' },
  { key: 'aco_pilares',  label: 'Aco para Pilares',  category: 'aco', placeholder: 'ex: CA-50 10mm + estribos CA-60 6.3mm' },
  { key: 'aco_vigas',    label: 'Aco para Vigas',    category: 'aco', placeholder: 'ex: CA-50 12.5mm + estribos CA-60 6.3mm' },
  { key: 'aco_laje',     label: 'Aco para Laje',     category: 'aco', placeholder: 'ex: CA-60 5mm malha 15x15' },
  { key: 'aco_sapatas',  label: 'Aco para Sapatas',  category: 'aco', placeholder: 'ex: CA-50 12.5mm' },
];

export const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const fmtQty = (v: number, unit: string) =>
  `${v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${unit}`;
