/*
  Sistema de Multiplos Fornecedores por Insumo

  Alteracoes:
  1. Nova Tabela: material_suppliers
     - Relacionamento many-to-many entre materials e suppliers
     - Permite varios fornecedores por insumo
  
  2. Migracao de Dados
     - Migra fornecedores existentes para a nova tabela
  
  3. Seguranca
     - RLS habilitado com politicas
*/

-- Criar tabela de relacionamento material-fornecedor
CREATE TABLE IF NOT EXISTS material_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  unit_cost numeric DEFAULT 0 CHECK (unit_cost >= 0),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(material_id, supplier_id)
);

-- Comentários
COMMENT ON TABLE material_suppliers IS 'Relacionamento many-to-many entre materiais e fornecedores';
COMMENT ON COLUMN material_suppliers.is_primary IS 'Indica se este é o fornecedor principal do material';
COMMENT ON COLUMN material_suppliers.unit_cost IS 'Custo unitário específico deste fornecedor para este material';

-- Migrar dados existentes
INSERT INTO material_suppliers (material_id, supplier_id, is_primary, unit_cost)
SELECT id, supplier_id, true, unit_cost
FROM materials
WHERE supplier_id IS NOT NULL
ON CONFLICT (material_id, supplier_id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE material_suppliers ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Allow anonymous access to material_suppliers"
  ON material_suppliers
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated access to material_suppliers"
  ON material_suppliers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_material_supplier_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_material_supplier_timestamp ON material_suppliers;
CREATE TRIGGER trigger_update_material_supplier_timestamp
  BEFORE UPDATE ON material_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_material_supplier_timestamp();