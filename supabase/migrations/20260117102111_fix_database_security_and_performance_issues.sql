/*
  # Correção de Segurança e Performance do Banco de Dados

  ## Problemas Corrigidos

  ### 1. Índices para Foreign Keys (Performance)
  Adiciona índices para todas as foreign keys que não possuíam, melhorando significativamente
  a performance de queries que fazem JOIN ou filtram por essas colunas:
  
  - client_notifications: project_id, property_id
  - construction_expenses: project_id
  - construction_progress: project_id
  - construction_projects: customer_id
  - document_deadlines: property_id
  - engineering_projects: customer_id
  - material_movements: production_id
  - monthly_extra_payments: employee_id
  - pending_purchases: cost_category_id
  - product_tracking: production_id, production_order_id
  - production: production_order_id
  - production_orders: customer_id, quote_id
  - products: recipe_id
  - project_payments: project_id
  - properties: customer_id
  - property_documents: property_id
  - purchase_items: purchase_id
  - purchases: supplier_id
  - quotes: customer_id
  - recipe_items: material_id
  - ribbed_slab_quotes: customer_id
  - ribbed_slab_rooms: reinforcement_material_id
  - sale_deliveries: responsible_id
  - sale_items: composition_id, material_id, product_id, service_id
  - sale_payment_installments: cash_flow_id
  - service_approvals: service_request_id
  - service_requests: property_id, responded_by
  - stock_alerts: production_order_id
  - whatsapp_notifications: deadline_id, property_id

  ### 2. Remoção de Índices Não Utilizados (Limpeza)
  Remove índices que não estão sendo usados pelo banco, liberando espaço e reduzindo overhead
  de manutenção em operações de INSERT/UPDATE/DELETE.

  ### 3. Remoção de Políticas RLS Duplicadas (Segurança)
  Remove políticas RLS permissivas duplicadas que podem causar acesso não intencional:
  
  - customer_access_tokens: Remove política "Tokens podem ser validados publicamente"
  - service_requests: Remove políticas duplicadas, mantém apenas "Sistema pode gerenciar solicitações"
  - services: Remove política "Allow public access to services", mantém "Allow all operations on services"

  ## Notas Importantes
  
  - Todos os índices são criados com IF NOT EXISTS para evitar erros
  - Políticas são removidas com IF EXISTS para evitar erros
  - Esta migration melhora tanto segurança quanto performance
*/

-- ============================================================================
-- PARTE 1: ADICIONAR ÍNDICES PARA FOREIGN KEYS
-- ============================================================================

-- client_notifications
CREATE INDEX IF NOT EXISTS idx_client_notifications_project_id ON public.client_notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_client_notifications_property_id ON public.client_notifications(property_id);

-- construction_expenses
CREATE INDEX IF NOT EXISTS idx_construction_expenses_project_id ON public.construction_expenses(project_id);

-- construction_progress
CREATE INDEX IF NOT EXISTS idx_construction_progress_project_id ON public.construction_progress(project_id);

-- construction_projects
CREATE INDEX IF NOT EXISTS idx_construction_projects_customer_id ON public.construction_projects(customer_id);

-- document_deadlines
CREATE INDEX IF NOT EXISTS idx_document_deadlines_property_id ON public.document_deadlines(property_id);

-- engineering_projects
CREATE INDEX IF NOT EXISTS idx_engineering_projects_customer_id ON public.engineering_projects(customer_id);

-- material_movements
CREATE INDEX IF NOT EXISTS idx_material_movements_production_id ON public.material_movements(production_id);

-- monthly_extra_payments
CREATE INDEX IF NOT EXISTS idx_monthly_extra_payments_employee_id ON public.monthly_extra_payments(employee_id);

-- pending_purchases
CREATE INDEX IF NOT EXISTS idx_pending_purchases_cost_category_id ON public.pending_purchases(cost_category_id);

-- product_tracking
CREATE INDEX IF NOT EXISTS idx_product_tracking_production_id ON public.product_tracking(production_id);
CREATE INDEX IF NOT EXISTS idx_product_tracking_production_order_id ON public.product_tracking(production_order_id);

-- production
CREATE INDEX IF NOT EXISTS idx_production_production_order_id ON public.production(production_order_id);

-- production_orders
CREATE INDEX IF NOT EXISTS idx_production_orders_customer_id ON public.production_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_quote_id ON public.production_orders(quote_id);

-- products
CREATE INDEX IF NOT EXISTS idx_products_recipe_id ON public.products(recipe_id);

-- project_payments
CREATE INDEX IF NOT EXISTS idx_project_payments_project_id ON public.project_payments(project_id);

-- properties
CREATE INDEX IF NOT EXISTS idx_properties_customer_id ON public.properties(customer_id);

-- property_documents
CREATE INDEX IF NOT EXISTS idx_property_documents_property_id ON public.property_documents(property_id);

-- purchase_items
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);

-- purchases
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases(supplier_id);

-- quotes
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON public.quotes(customer_id);

-- recipe_items
CREATE INDEX IF NOT EXISTS idx_recipe_items_material_id ON public.recipe_items(material_id);

-- ribbed_slab_quotes
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_quotes_customer_id ON public.ribbed_slab_quotes(customer_id);

-- ribbed_slab_rooms
CREATE INDEX IF NOT EXISTS idx_ribbed_slab_rooms_reinforcement_material_id ON public.ribbed_slab_rooms(reinforcement_material_id);

-- sale_deliveries
CREATE INDEX IF NOT EXISTS idx_sale_deliveries_responsible_id ON public.sale_deliveries(responsible_id);

-- sale_items
CREATE INDEX IF NOT EXISTS idx_sale_items_composition_id ON public.sale_items(composition_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_material_id ON public.sale_items(material_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_service_id ON public.sale_items(service_id);

-- sale_payment_installments
CREATE INDEX IF NOT EXISTS idx_sale_payment_installments_cash_flow_id ON public.sale_payment_installments(cash_flow_id);

-- service_approvals
CREATE INDEX IF NOT EXISTS idx_service_approvals_service_request_id ON public.service_approvals(service_request_id);

-- service_requests
CREATE INDEX IF NOT EXISTS idx_service_requests_property_id ON public.service_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_responded_by ON public.service_requests(responded_by);

-- stock_alerts
CREATE INDEX IF NOT EXISTS idx_stock_alerts_production_order_id ON public.stock_alerts(production_order_id);

-- whatsapp_notifications
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_deadline_id ON public.whatsapp_notifications(deadline_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notifications_property_id ON public.whatsapp_notifications(property_id);

-- ============================================================================
-- PARTE 2: REMOVER ÍNDICES NÃO UTILIZADOS
-- ============================================================================

DROP INDEX IF EXISTS idx_delivery_items_product_id;
DROP INDEX IF EXISTS idx_delivery_items_quote_item_id;
DROP INDEX IF EXISTS idx_sales_production_status;
DROP INDEX IF EXISTS idx_sales_delivery_completion_status;
DROP INDEX IF EXISTS idx_sales_overall_status;
DROP INDEX IF EXISTS idx_ribbed_slab_floors_quote_id;
DROP INDEX IF EXISTS idx_ribbed_slab_rooms_floor_id;
DROP INDEX IF EXISTS idx_customer_access_tokens_customer;
DROP INDEX IF EXISTS idx_customer_access_tokens_phone;
DROP INDEX IF EXISTS idx_service_requests_status;
DROP INDEX IF EXISTS idx_service_requests_created;
DROP INDEX IF EXISTS idx_service_approvals_status;
DROP INDEX IF EXISTS idx_service_approvals_project;
DROP INDEX IF EXISTS idx_client_notifications_unread;
DROP INDEX IF EXISTS idx_client_notifications_created;
DROP INDEX IF EXISTS idx_assets_purchase_item_id;
DROP INDEX IF EXISTS idx_cash_flow_cost_category_id;
DROP INDEX IF EXISTS idx_cash_flow_payment_method_id;
DROP INDEX IF EXISTS idx_cash_flow_purchase_id;
DROP INDEX IF EXISTS idx_composition_items_material_id;
DROP INDEX IF EXISTS idx_construction_expenses_payment_method_id;
DROP INDEX IF EXISTS idx_construction_expenses_supplier_id;
DROP INDEX IF EXISTS idx_material_suppliers_supplier_id;
DROP INDEX IF EXISTS idx_overtime_records_employee_id;
DROP INDEX IF EXISTS idx_product_material_weights_material_id;
DROP INDEX IF EXISTS idx_product_reinforcements_material_id;
DROP INDEX IF EXISTS idx_product_reinforcements_product_id;
DROP INDEX IF EXISTS idx_project_payments_payment_method_id;
DROP INDEX IF EXISTS idx_purchase_items_cost_category_id;
DROP INDEX IF EXISTS idx_service_templates_active;
DROP INDEX IF EXISTS idx_checklist_items_service;
DROP INDEX IF EXISTS idx_products_is_simple_registration;
DROP INDEX IF EXISTS idx_quote_items_quote_id;
DROP INDEX IF EXISTS idx_quote_items_product_id;
DROP INDEX IF EXISTS idx_quote_items_material_id;
DROP INDEX IF EXISTS idx_quote_items_composition_id;
DROP INDEX IF EXISTS idx_mold_reinforcements_type;
DROP INDEX IF EXISTS idx_products_mold_id;
DROP INDEX IF EXISTS idx_ribbed_slab_quotes_block_material_id;
DROP INDEX IF EXISTS idx_ribbed_slab_rooms_material_id;
DROP INDEX IF EXISTS idx_ribbed_slab_rooms_recipe_id;
DROP INDEX IF EXISTS idx_ribbed_slab_quotes_status;
DROP INDEX IF EXISTS idx_ribbed_slab_quotes_production_order;
DROP INDEX IF EXISTS idx_mold_reinforcements_location;
DROP INDEX IF EXISTS idx_product_reinforcements_location;
DROP INDEX IF EXISTS idx_sales_customer;
DROP INDEX IF EXISTS idx_sales_quote;
DROP INDEX IF EXISTS idx_sales_date;
DROP INDEX IF EXISTS idx_sales_status;
DROP INDEX IF EXISTS idx_sales_payment_status;
DROP INDEX IF EXISTS idx_sale_installments_sale;
DROP INDEX IF EXISTS idx_sale_installments_payment;
DROP INDEX IF EXISTS idx_production_order_items_product_id;
DROP INDEX IF EXISTS idx_production_order_items_material_id;
DROP INDEX IF EXISTS idx_production_order_items_composition_id;
DROP INDEX IF EXISTS idx_production_tracking_stages_stage;
DROP INDEX IF EXISTS idx_production_tracking_stages_completed;
DROP INDEX IF EXISTS idx_production_stages_key;

-- ============================================================================
-- PARTE 3: REMOVER POLÍTICAS RLS DUPLICADAS E PROBLEMÁTICAS
-- ============================================================================

-- customer_access_tokens: Remover política duplicada
DROP POLICY IF EXISTS "Tokens podem ser validados publicamente" ON public.customer_access_tokens;

-- service_requests: Remover políticas duplicadas, manter apenas a política do sistema
DROP POLICY IF EXISTS "Clientes podem criar solicitações" ON public.service_requests;
DROP POLICY IF EXISTS "Clientes veem suas próprias solicitações" ON public.service_requests;

-- services: Remover política duplicada
DROP POLICY IF EXISTS "Allow public access to services" ON public.services;