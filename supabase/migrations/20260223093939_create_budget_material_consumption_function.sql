/*
  # Create get_budget_material_consumption function

  ## Purpose
  Calculates the total material consumption for a budget by:
  1. Fetching all budget elements with their calculated volumes/quantities (m³ or m²)
  2. Mapping each element_type to its corresponding budget_global_param (e.g., pilar -> traco_concreto_pilar)
  3. Using the linked recipe's items and specific_weight to compute kg per material per m³
  4. Aggregating consumption across all elements

  ## Conversion Formula
  For each element with volume V (m³):
    - total_mass = V × specific_weight (kg)
    - mass_of_material_i = total_mass × (qty_i / sum_all_qty)
    - kg_per_m3_i = specific_weight × (qty_i / sum_all_qty)

  ## Returns
  One row per material with:
  - material_id, material_name, unit
  - total_consumption_kg (total kg needed for the entire budget)
  - total_consumption_m3 (converted to m³ if unit is m³-compatible)
  - bags_50kg (for cement-like materials)
  - element_type breakdown (JSON)
  - has_recipe (whether a recipe was found for this consumption)

  ## Notes
  - Only considers elements with calculated_unit = 'm3' (concrete/mortar elements)
  - Only processes params that have a recipe_id with specific_weight > 0
  - Returns empty for elements with no linked recipe
*/

-- Element type -> param_key mapping
-- This maps each structural element type to its global param key
CREATE OR REPLACE FUNCTION get_element_param_key(p_element_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_element_type
    WHEN 'sapata'              THEN 'traco_concreto_sapata'
    WHEN 'bloco_fundacao'      THEN 'traco_concreto_sapata'
    WHEN 'baldrame'            THEN 'traco_concreto_baldrame'
    WHEN 'radier'              THEN 'traco_concreto_laje'
    WHEN 'estaca'              THEN 'traco_concreto_sapata'
    WHEN 'pilar'               THEN 'traco_concreto_pilar'
    WHEN 'viga'                THEN 'traco_concreto_viga'
    WHEN 'laje'                THEN 'traco_concreto_laje'
    WHEN 'escada'              THEN 'traco_concreto_laje'
    WHEN 'parede_alvenaria'    THEN 'traco_argamassa_assentamento'
    WHEN 'muro'                THEN 'traco_argamassa_assentamento'
    WHEN 'revestimento_piso'   THEN 'traco_argamassa_emboco'
    WHEN 'revestimento_parede' THEN 'traco_argamassa_reboco'
    WHEN 'revestimento_teto'   THEN 'traco_argamassa_reboco'
    WHEN 'pavimentacao_concreto' THEN 'traco_concreto_laje'
    ELSE NULL
  END;
$$;

-- Main consumption function
CREATE OR REPLACE FUNCTION get_budget_material_consumption(p_budget_id uuid)
RETURNS TABLE (
  material_id    uuid,
  material_name  text,
  unit           text,
  element_type   text,
  element_label  text,
  param_key      text,
  recipe_id      uuid,
  recipe_name    text,
  volume_m3      numeric,
  consumption_kg numeric,
  bags_50kg      numeric,
  specific_weight numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Get all elements with m3 volumes that have a mapping
  elements_with_volume AS (
    SELECT
      be.id          AS element_id,
      be.element_type,
      be.calculated_quantity AS vol,
      be.calculated_unit,
      get_element_param_key(be.element_type) AS param_key
    FROM budget_elements be
    WHERE be.budget_id = p_budget_id
      AND be.calculated_quantity > 0
      AND be.calculated_unit IN ('m3', 'm2')
      AND be.measurement_status != 'ignorado'
      AND get_element_param_key(be.element_type) IS NOT NULL
  ),
  -- Aggregate volume by element_type + param_key
  volumes_by_param AS (
    SELECT
      ev.element_type,
      ev.param_key,
      SUM(ev.vol) AS total_vol
    FROM elements_with_volume ev
    GROUP BY ev.element_type, ev.param_key
  ),
  -- Join with budget_global_params to get recipe_id
  params_with_recipe AS (
    SELECT
      vp.element_type,
      vp.param_key,
      vp.total_vol,
      bgp.recipe_id,
      bgp.param_label
    FROM volumes_by_param vp
    JOIN budget_global_params bgp
      ON bgp.budget_id = p_budget_id
      AND bgp.param_key = vp.param_key
      AND bgp.recipe_id IS NOT NULL
  ),
  -- Get recipe total weight (sum of all recipe_items.quantity)
  recipe_totals AS (
    SELECT
      ri.recipe_id,
      SUM(ri.quantity) AS total_qty
    FROM recipe_items ri
    WHERE ri.recipe_id IN (SELECT DISTINCT pwr.recipe_id FROM params_with_recipe pwr)
    GROUP BY ri.recipe_id
  ),
  -- Final consumption per material per element_type
  consumption AS (
    SELECT
      pwr.element_type,
      pwr.param_key,
      pwr.param_label,
      pwr.recipe_id,
      r.name          AS recipe_name,
      r.specific_weight,
      pwr.total_vol,
      ri.material_id,
      m.name          AS mat_name,
      m.unit          AS mat_unit,
      ri.quantity     AS item_qty,
      rt.total_qty,
      -- consumption_kg = volume × specific_weight × (item_qty / total_qty)
      CASE
        WHEN rt.total_qty > 0 AND r.specific_weight > 0
        THEN pwr.total_vol * r.specific_weight * (ri.quantity / rt.total_qty)
        ELSE 0
      END AS consumption_kg
    FROM params_with_recipe pwr
    JOIN recipes r ON r.id = pwr.recipe_id
    JOIN recipe_totals rt ON rt.recipe_id = pwr.recipe_id
    JOIN recipe_items ri ON ri.recipe_id = pwr.recipe_id
    JOIN materials m ON m.id = ri.material_id
    WHERE r.specific_weight > 0
  )
  SELECT
    c.material_id::uuid,
    c.mat_name::text,
    c.mat_unit::text,
    c.element_type::text,
    c.param_label::text,
    c.param_key::text,
    c.recipe_id::uuid,
    c.recipe_name::text,
    ROUND(c.total_vol::numeric, 4)        AS volume_m3,
    ROUND(c.consumption_kg::numeric, 2)   AS consumption_kg,
    ROUND((c.consumption_kg / 50.0)::numeric, 2) AS bags_50kg,
    c.specific_weight::numeric
  FROM consumption c
  ORDER BY c.element_type, c.mat_name;
END;
$$;

-- Aggregated version: one row per material across all element types
CREATE OR REPLACE FUNCTION get_budget_material_consumption_summary(p_budget_id uuid)
RETURNS TABLE (
  material_id       uuid,
  material_name     text,
  unit              text,
  total_consumption_kg numeric,
  bags_50kg         numeric,
  contributing_types jsonb,
  missing_recipes   jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Get detail rows
  detail AS (
    SELECT * FROM get_budget_material_consumption(p_budget_id)
  ),
  -- Elements without a recipe (for warnings)
  missing AS (
    SELECT
      be.element_type,
      be.calculated_quantity AS vol,
      get_element_param_key(be.element_type) AS param_key
    FROM budget_elements be
    WHERE be.budget_id = p_budget_id
      AND be.calculated_quantity > 0
      AND be.calculated_unit IN ('m3', 'm2')
      AND be.measurement_status != 'ignorado'
      AND get_element_param_key(be.element_type) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM budget_global_params bgp
        WHERE bgp.budget_id = p_budget_id
          AND bgp.param_key = get_element_param_key(be.element_type)
          AND bgp.recipe_id IS NOT NULL
      )
    GROUP BY be.element_type, get_element_param_key(be.element_type)
  )
  SELECT
    d.material_id::uuid,
    d.material_name::text,
    d.unit::text,
    ROUND(SUM(d.consumption_kg)::numeric, 2)      AS total_consumption_kg,
    ROUND((SUM(d.consumption_kg) / 50.0)::numeric, 2) AS bags_50kg,
    jsonb_agg(DISTINCT jsonb_build_object(
      'element_type', d.element_type,
      'element_label', d.element_label,
      'volume_m3', d.volume_m3,
      'consumption_kg', d.consumption_kg
    )) AS contributing_types,
    (
      SELECT jsonb_agg(jsonb_build_object('element_type', m.element_type, 'param_key', m.param_key))
      FROM missing m
    ) AS missing_recipes
  FROM detail d
  GROUP BY d.material_id, d.material_name, d.unit
  ORDER BY SUM(d.consumption_kg) DESC;
END;
$$;
