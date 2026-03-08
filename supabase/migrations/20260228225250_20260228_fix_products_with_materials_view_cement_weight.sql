/*
  # Fix Products with Materials View - Complete Cement Weight Data

  1. Issue
    - The products_with_materials_view contained a LIMIT 1 clause that was restricting cement weight calculation
    - This limited the data in product exports to only 1 record per material

  2. Changes
    - Modify cement_weight calculation to use SUM instead of limiting to 1 result
    - This ensures complete data for all materials and products is returned

  3. Impact
    - Product downloads will now include complete cement weight information
    - All product materials will be included without truncation
    - Export file sizes will be restored to normal
*/

CREATE OR REPLACE VIEW products_with_materials_view AS
SELECT 
  id,
  name,
  description,
  unit,
  created_at,
  recipe_id,
  total_weight,
  sale_price,
  margin_percentage,
  last_price_update,
  minimum_stock,
  product_type,
  concrete_volume_m3,
  production_cost,
  tax_percentage,
  final_sale_price,
  material_cost,
  labor_cost,
  fixed_cost,
  transport_cost,
  loss_cost,
  column_section_width_cm,
  column_section_height_cm,
  column_section_area_m2,
  column_length_total,
  reference_measurement,
  reference_volume,
  is_simple_registration,
  manual_unit_cost,
  manual_tax_percentage,
  manual_profit_margin_percentage,
  manual_final_price,
  mold_id,
  code,
  has_flange,
  flange_length_meters,
  flange_volume_m3,
  enable_stage_tracking,
  ncm,
  cfop,
  cst_icms,
  aliquota_icms,
  aliquota_pis,
  aliquota_cofins,
  aliquota_ipi,
  origem_produto,
  unidade_tributavel,
  csosn,
  peso_artefato,
  COALESCE(( 
    SELECT SUM(pmw.weight_per_unit)
    FROM (product_material_weights pmw
      JOIN materials m ON ((m.id = pmw.material_id)))
    WHERE ((pmw.product_id = p.id) AND (m.name ~~* '%cimento%'::text))
  ), (0)::numeric) AS cement_weight
FROM products p;
