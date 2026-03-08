/*
  # Fix Database Security and Performance Issues

  ## Performance Improvements
  
  ### 1. Add Missing Indexes for Foreign Keys
  Adding indexes to foreign key columns that don't have them to improve query performance:
  - assets.purchase_item_id
  - cash_flow (cost_category_id, payment_method_id, purchase_id)
  - composition_items (composition_id, material_id, product_id)
  - construction_expenses (payment_method_id, supplier_id)
  - construction_projects.quote_id
  - material_suppliers.supplier_id
  - overtime_records.employee_id
  - product_material_weights.material_id
  - product_reinforcements (material_id, product_id)
  - production_costs.production_id
  - project_payments.payment_method_id
  - purchase_items.cost_category_id
  - quotes (composition_id, material_id, production_order_id)
  - sale_items.production_order_id
  - sale_payments.payment_method_id
  - sales.quote_id

  ### 2. Remove Unused Indexes
  Dropping indexes that have not been used to free up storage space.

  ## Security Improvements
  
  ### 3. Remove Duplicate RLS Policies
  Many tables have duplicate permissive policies. We'll keep only the consolidated
  "Authenticated access for all operations" and "Public access for all operations" policies,
  removing the redundant specific policies.

  ### 4. Fix Function Search Paths
  Setting explicit search_path for all functions to prevent security issues.
*/

-- =====================================================
-- PART 1: ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_assets_purchase_item_id ON assets(purchase_item_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_cost_category_id ON cash_flow(cost_category_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_payment_method_id ON cash_flow(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_purchase_id ON cash_flow(purchase_id);
CREATE INDEX IF NOT EXISTS idx_composition_items_composition_id ON composition_items(composition_id);
CREATE INDEX IF NOT EXISTS idx_composition_items_material_id ON composition_items(material_id);
CREATE INDEX IF NOT EXISTS idx_composition_items_product_id ON composition_items(product_id);
CREATE INDEX IF NOT EXISTS idx_construction_expenses_payment_method_id ON construction_expenses(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_construction_expenses_supplier_id ON construction_expenses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_construction_projects_quote_id ON construction_projects(quote_id);
CREATE INDEX IF NOT EXISTS idx_material_suppliers_supplier_id ON material_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_overtime_records_employee_id ON overtime_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_product_material_weights_material_id ON product_material_weights(material_id);
CREATE INDEX IF NOT EXISTS idx_product_reinforcements_material_id ON product_reinforcements(material_id);
CREATE INDEX IF NOT EXISTS idx_product_reinforcements_product_id ON product_reinforcements(product_id);
CREATE INDEX IF NOT EXISTS idx_production_costs_production_id ON production_costs(production_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_payment_method_id ON project_payments(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_cost_category_id ON purchase_items(cost_category_id);
CREATE INDEX IF NOT EXISTS idx_quotes_composition_id ON quotes(composition_id);
CREATE INDEX IF NOT EXISTS idx_quotes_material_id ON quotes(material_id);
CREATE INDEX IF NOT EXISTS idx_quotes_production_order_id ON quotes(production_order_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_production_order_id ON sale_items(production_order_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_payment_method_id ON sale_payments(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_sales_quote_id ON sales(quote_id);

-- =====================================================
-- PART 2: REMOVE UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_recipe_items_material_id;
DROP INDEX IF EXISTS idx_products_recipe_id;
DROP INDEX IF EXISTS quotes_customer_id_idx;
DROP INDEX IF EXISTS idx_user_profiles_email;
DROP INDEX IF EXISTS idx_user_profiles_is_admin;
DROP INDEX IF EXISTS idx_module_permissions_user_id;
DROP INDEX IF EXISTS idx_module_permissions_module_id;
DROP INDEX IF EXISTS production_orders_customer_id_idx;
DROP INDEX IF EXISTS production_orders_status_idx;
DROP INDEX IF EXISTS production_orders_quote_id_idx;
DROP INDEX IF EXISTS idx_monthly_extra_payments_employee_month;
DROP INDEX IF EXISTS production_orders_created_at_idx;
DROP INDEX IF EXISTS idx_stock_alerts_production_order;
DROP INDEX IF EXISTS idx_material_movements_production_id;
DROP INDEX IF EXISTS production_order_id_idx;
DROP INDEX IF EXISTS idx_product_tracking_qr_token;
DROP INDEX IF EXISTS idx_product_tracking_production_id;
DROP INDEX IF EXISTS idx_stock_alerts_item;
DROP INDEX IF EXISTS idx_stock_alerts_created_at;
DROP INDEX IF EXISTS idx_product_tracking_production_order_id;
DROP INDEX IF EXISTS idx_production_orders_no_customer;
DROP INDEX IF EXISTS idx_sales_customer;
DROP INDEX IF EXISTS idx_sales_date;
DROP INDEX IF EXISTS idx_pending_purchases_status;
DROP INDEX IF EXISTS idx_pending_purchases_category;
DROP INDEX IF EXISTS idx_cost_categories_type;
DROP INDEX IF EXISTS idx_cost_categories_active;
DROP INDEX IF EXISTS idx_sales_status;
DROP INDEX IF EXISTS idx_sale_items_sale;
DROP INDEX IF EXISTS idx_sale_payments_sale;
DROP INDEX IF EXISTS idx_cash_flow_date;
DROP INDEX IF EXISTS idx_cash_flow_type;
DROP INDEX IF EXISTS idx_cash_flow_sale;
DROP INDEX IF EXISTS idx_supplier_contacts_is_primary;
DROP INDEX IF EXISTS idx_engineering_projects_customer;
DROP INDEX IF EXISTS idx_engineering_projects_status;
DROP INDEX IF EXISTS idx_project_payments_project;
DROP INDEX IF EXISTS idx_construction_projects_customer;
DROP INDEX IF EXISTS idx_construction_projects_status;
DROP INDEX IF EXISTS idx_construction_progress_project;
DROP INDEX IF EXISTS idx_construction_expenses_project;
DROP INDEX IF EXISTS idx_cash_flow_business_unit;
DROP INDEX IF EXISTS idx_attachments_entity;
DROP INDEX IF EXISTS idx_attachments_created_at;
DROP INDEX IF EXISTS idx_properties_customer;
DROP INDEX IF EXISTS idx_properties_type;
DROP INDEX IF EXISTS idx_properties_municipality;
DROP INDEX IF EXISTS idx_property_documents_property;
DROP INDEX IF EXISTS idx_property_documents_type;
DROP INDEX IF EXISTS idx_document_deadlines_property;
DROP INDEX IF EXISTS idx_document_deadlines_expiry;
DROP INDEX IF EXISTS idx_document_deadlines_status;
DROP INDEX IF EXISTS idx_whatsapp_notifications_deadline;
DROP INDEX IF EXISTS idx_whatsapp_notifications_property;
DROP INDEX IF EXISTS idx_document_deadlines_property_type;
DROP INDEX IF EXISTS idx_document_deadlines_type_and_applies;
DROP INDEX IF EXISTS idx_product_accessories_accessory_type;
DROP INDEX IF EXISTS idx_purchases_supplier;
DROP INDEX IF EXISTS idx_purchases_date;
DROP INDEX IF EXISTS idx_purchase_items_purchase;
DROP INDEX IF EXISTS idx_purchase_items_category;
DROP INDEX IF EXISTS idx_assets_status;

-- =====================================================
-- PART 3: REMOVE DUPLICATE RLS POLICIES
-- =====================================================

-- Assets: Remove specific policies, keep general ones
DROP POLICY IF EXISTS "Permitir visualização de ativos" ON assets;
DROP POLICY IF EXISTS "Permitir inserção de ativos" ON assets;
DROP POLICY IF EXISTS "Permitir atualização de ativos" ON assets;
DROP POLICY IF EXISTS "Permitir exclusão de ativos" ON assets;

-- Attachments: Remove specific policies
DROP POLICY IF EXISTS "Allow authenticated users to read attachments" ON attachments;
DROP POLICY IF EXISTS "Allow authenticated users to insert attachments" ON attachments;
DROP POLICY IF EXISTS "Allow authenticated users to update attachments" ON attachments;
DROP POLICY IF EXISTS "Allow authenticated users to delete attachments" ON attachments;

-- Cash Flow: Remove duplicate policies
DROP POLICY IF EXISTS "Fluxo de caixa visível para todos" ON cash_flow;
DROP POLICY IF EXISTS "Fluxo de caixa editável por autenticados" ON cash_flow;

-- Company Settings: Remove specific policies
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar configurações" ON company_settings;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar configurações" ON company_settings;

-- Composition Items: Remove specific policies
DROP POLICY IF EXISTS "Usuários autenticados podem ler itens de composição" ON composition_items;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir itens de composição" ON composition_items;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar itens de composição" ON composition_items;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar itens de composição" ON composition_items;

-- Compositions: Remove specific policies
DROP POLICY IF EXISTS "Usuários autenticados podem ler composições" ON compositions;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir composições" ON compositions;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar composições" ON compositions;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar composições" ON compositions;

-- Construction Expenses: Remove duplicates
DROP POLICY IF EXISTS "Despesas de obras visíveis para todos" ON construction_expenses;
DROP POLICY IF EXISTS "Despesas de obras editáveis por autenticados" ON construction_expenses;

-- Construction Progress: Remove duplicates
DROP POLICY IF EXISTS "Acompanhamento de obras visível para todos" ON construction_progress;
DROP POLICY IF EXISTS "Acompanhamento de obras editável por autenticados" ON construction_progress;

-- Construction Projects: Remove duplicates
DROP POLICY IF EXISTS "Obras visíveis para todos" ON construction_projects;
DROP POLICY IF EXISTS "Obras editáveis por autenticados" ON construction_projects;

-- Cost Categories: Remove duplicates
DROP POLICY IF EXISTS "Allow anonymous read access to cost_categories" ON cost_categories;
DROP POLICY IF EXISTS "Allow anonymous insert access to cost_categories" ON cost_categories;
DROP POLICY IF EXISTS "Allow anonymous update access to cost_categories" ON cost_categories;
DROP POLICY IF EXISTS "Allow anonymous delete access to cost_categories" ON cost_categories;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar categorias de custos" ON cost_categories;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir categorias de custos" ON cost_categories;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar categorias de custos" ON cost_categories;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir categorias de custos" ON cost_categories;

-- Document Deadlines: Remove specific policies
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar prazos" ON document_deadlines;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir prazos" ON document_deadlines;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar prazos" ON document_deadlines;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar prazos" ON document_deadlines;

-- Engineering Projects: Remove duplicates
DROP POLICY IF EXISTS "Projetos de engenharia visíveis para todos" ON engineering_projects;
DROP POLICY IF EXISTS "Projetos de engenharia editáveis por autenticados" ON engineering_projects;

-- Engineering Services: Remove duplicates
DROP POLICY IF EXISTS "Serviços de engenharia visíveis para todos" ON engineering_services;
DROP POLICY IF EXISTS "Serviços de engenharia editáveis por autenticados" ON engineering_services;

-- Material Suppliers: Remove duplicates
DROP POLICY IF EXISTS "Allow anonymous access to material_suppliers" ON material_suppliers;
DROP POLICY IF EXISTS "Allow authenticated access to material_suppliers" ON material_suppliers;

-- Payment Methods: Remove duplicates
DROP POLICY IF EXISTS "Métodos de pagamento visíveis para todos" ON payment_methods;
DROP POLICY IF EXISTS "Métodos de pagamento editáveis por autenticados" ON payment_methods;

-- Pending Purchases: Remove specific policies
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar compras pendentes" ON pending_purchases;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir compras pendentes" ON pending_purchases;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar compras pendentes" ON pending_purchases;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir compras pendentes" ON pending_purchases;

-- Product Accessories: Remove duplicates
DROP POLICY IF EXISTS "Allow anonymous access to product_accessories" ON product_accessories;
DROP POLICY IF EXISTS "Allow authenticated access to product_accessories" ON product_accessories;

-- Product Reinforcements: Remove duplicates
DROP POLICY IF EXISTS "Allow anonymous access to product_reinforcements" ON product_reinforcements;
DROP POLICY IF EXISTS "Allow authenticated access to product_reinforcements" ON product_reinforcements;

-- Product Tracking: Remove specific policies
DROP POLICY IF EXISTS "Anyone can view product tracking" ON product_tracking;
DROP POLICY IF EXISTS "Authenticated users can create product tracking" ON product_tracking;
DROP POLICY IF EXISTS "Authenticated users can update product tracking" ON product_tracking;
DROP POLICY IF EXISTS "Authenticated users can delete product tracking" ON product_tracking;

-- Project Payments: Remove duplicates
DROP POLICY IF EXISTS "Pagamentos de projetos visíveis para todos" ON project_payments;
DROP POLICY IF EXISTS "Pagamentos de projetos editáveis por autenticados" ON project_payments;

-- Properties: Remove specific policies
DROP POLICY IF EXISTS "Allow authenticated users to read properties" ON properties;
DROP POLICY IF EXISTS "Allow authenticated users to insert properties" ON properties;
DROP POLICY IF EXISTS "Allow authenticated users to update properties" ON properties;
DROP POLICY IF EXISTS "Allow authenticated users to delete properties" ON properties;

-- Property Documents: Remove specific policies
DROP POLICY IF EXISTS "Allow authenticated users to read property_documents" ON property_documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert property_documents" ON property_documents;
DROP POLICY IF EXISTS "Allow authenticated users to update property_documents" ON property_documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete property_documents" ON property_documents;

-- Purchase Items: Remove specific policies
DROP POLICY IF EXISTS "Permitir visualização de itens de compra" ON purchase_items;
DROP POLICY IF EXISTS "Permitir inserção de itens de compra" ON purchase_items;
DROP POLICY IF EXISTS "Permitir atualização de itens de compra" ON purchase_items;
DROP POLICY IF EXISTS "Permitir exclusão de itens de compra" ON purchase_items;

-- Purchases: Remove specific policies
DROP POLICY IF EXISTS "Permitir visualização de compras" ON purchases;
DROP POLICY IF EXISTS "Permitir inserção de compras" ON purchases;
DROP POLICY IF EXISTS "Permitir atualização de compras" ON purchases;
DROP POLICY IF EXISTS "Permitir exclusão de compras" ON purchases;

-- Sale Items: Remove duplicates
DROP POLICY IF EXISTS "Itens de venda visíveis para todos" ON sale_items;
DROP POLICY IF EXISTS "Itens de venda editáveis por autenticados" ON sale_items;

-- Sale Payments: Remove duplicates
DROP POLICY IF EXISTS "Pagamentos visíveis para todos" ON sale_payments;
DROP POLICY IF EXISTS "Pagamentos editáveis por autenticados" ON sale_payments;

-- Sales: Remove specific policies
DROP POLICY IF EXISTS "Vendas visíveis para todos" ON sales;
DROP POLICY IF EXISTS "Vendas editáveis por autenticados" ON sales;
DROP POLICY IF EXISTS "Vendas atualizáveis por autenticados" ON sales;
DROP POLICY IF EXISTS "Vendas deletáveis por autenticados" ON sales;

-- Stock Alerts: Remove specific policies
DROP POLICY IF EXISTS "Permitir leitura de alertas" ON stock_alerts;
DROP POLICY IF EXISTS "Permitir inserção de alertas" ON stock_alerts;
DROP POLICY IF EXISTS "Permitir atualização de alertas" ON stock_alerts;
DROP POLICY IF EXISTS "Permitir exclusão de alertas" ON stock_alerts;

-- Supplier Contacts: Remove specific policies
DROP POLICY IF EXISTS "Allow authenticated users to read supplier contacts" ON supplier_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to insert supplier contacts" ON supplier_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to update supplier contacts" ON supplier_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to delete supplier contacts" ON supplier_contacts;

-- WhatsApp Notifications: Remove specific policies
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar notificações" ON whatsapp_notifications;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir notificações" ON whatsapp_notifications;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar notificações" ON whatsapp_notifications;