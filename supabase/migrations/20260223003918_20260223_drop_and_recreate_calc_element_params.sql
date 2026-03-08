/*
  # Drop and recreate calc_element_params with reinforcement support

  ## Summary
  Drops the existing calc_element_params function and recreates it with full
  reinforcement calculation support for structural elements.

  ## Changes
  - Returns jsonb (same type as before, just richer content)
  - All existing element types preserved
  - New reinforcement outputs: arm_long_m, arm_long_kg, arm_trans_m, arm_trans_kg,
    estribo_perimetro, estribo_qtd
  - Steel weight formula: phi_mm^2 * 0.00617 kg/m (standard)
  - Hook length: 12.5 * diameter (NBR 6118)
*/

DROP FUNCTION IF EXISTS calc_element_params(text, jsonb);

CREATE OR REPLACE FUNCTION calc_element_params(
  p_element_type text,
  p_params jsonb
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb := '{}';
  v_b float8 := 0; v_l float8 := 0; v_h float8 := 0; v_e float8 := 0;
  v_d float8 := 0; v_qtd float8 := 1; v_area float8 := 0; v_vol float8 := 0;
  v_cob float8 := 0;
  v_arm_long_diam float8 := 0; v_arm_long_qtd float8 := 0;
  v_arm_long_qtd_inf float8 := 0; v_arm_long_qtd_sup float8 := 0;
  v_arm_long_qtd_b float8 := 0; v_arm_long_qtd_l float8 := 0;
  v_arm_trans_diam float8 := 0; v_arm_trans_esp float8 := 0;
  v_arm_diam float8 := 0; v_arm_esp float8 := 0;
  v_arm_long_m float8 := 0; v_arm_trans_m float8 := 0;
  v_arm_long_kg float8 := 0; v_arm_trans_kg float8 := 0;
  v_estribo_perim float8 := 0; v_estribo_qtd float8 := 0;
  v_gancho float8 := 0; v_resumo_arm text := '';
  v_qtd_b_dir float8 := 0; v_qtd_l_dir float8 := 0;
BEGIN
  v_b    := coalesce((p_params->>'largura')::float8, 0);
  v_l    := coalesce((p_params->>'comprimento')::float8, 0);
  v_h    := coalesce((p_params->>'altura')::float8, 0);
  v_e    := coalesce((p_params->>'espessura')::float8, 0);
  v_d    := coalesce((p_params->>'diametro')::float8, 0);
  v_qtd  := coalesce((p_params->>'quantidade')::float8, 1);
  IF v_qtd = 0 THEN v_qtd := 1; END IF;

  v_cob              := coalesce((p_params->>'cobrimento')::float8, 0.025);
  v_arm_long_diam    := coalesce((p_params->>'arm_long_diametro')::float8, 0);
  v_arm_long_qtd     := coalesce((p_params->>'arm_long_qtd')::float8, 0);
  v_arm_long_qtd_inf := coalesce((p_params->>'arm_long_qtd_inf')::float8, 0);
  v_arm_long_qtd_sup := coalesce((p_params->>'arm_long_qtd_sup')::float8, 0);
  v_arm_long_qtd_b   := coalesce((p_params->>'arm_long_qtd_b')::float8, 0);
  v_arm_long_qtd_l   := coalesce((p_params->>'arm_long_qtd_l')::float8, 0);
  v_arm_trans_diam   := coalesce((p_params->>'arm_trans_diametro')::float8, 0);
  v_arm_trans_esp    := coalesce((p_params->>'arm_trans_espacamento')::float8, 0);
  v_arm_diam         := coalesce((p_params->>'arm_diametro')::float8, 0);
  v_arm_esp          := coalesce((p_params->>'arm_espacamento')::float8, 0);

  IF p_element_type IN ('sapata', 'bloco_fundacao') THEN
    v_vol  := v_b * v_l * v_h * v_qtd;
    v_area := v_b * v_l * v_qtd;
    IF v_arm_long_diam > 0 AND (v_arm_long_qtd_b > 0 OR v_arm_long_qtd_l > 0) THEN
      v_gancho := 12.5 * (v_arm_long_diam / 1000.0) * 2;
      v_arm_long_m := (
        v_arm_long_qtd_b * (v_l - 2*v_cob + v_gancho) +
        v_arm_long_qtd_l * (v_b - 2*v_cob + v_gancho)
      ) * v_qtd;
      v_arm_long_kg := v_arm_long_m * power(v_arm_long_diam, 2) * 0.00617;
      v_resumo_arm := ' | Long: ' || round(v_arm_long_m::numeric,2)::text || 'm / ' || round(v_arm_long_kg::numeric,2)::text || 'kg';
    END IF;
    v_result := jsonb_build_object(
      'volume', round(v_vol::numeric, 4), 'area', round(v_area::numeric, 4), 'unit', 'm3',
      'arm_long_m', round(v_arm_long_m::numeric,3), 'arm_long_kg', round(v_arm_long_kg::numeric,3),
      'resumo', round(v_vol::numeric,3)::text || ' m3' || v_resumo_arm
    );

  ELSIF p_element_type IN ('baldrame', 'viga') THEN
    IF p_element_type = 'baldrame' THEN
      v_vol := v_b * v_h * v_l * v_qtd;
    ELSE
      v_vol := v_b * v_h * v_l * v_qtd;
    END IF;
    IF v_arm_long_diam > 0 THEN
      v_gancho := 12.5 * (v_arm_long_diam / 1000.0);
      v_arm_long_qtd := v_arm_long_qtd + v_arm_long_qtd_inf + v_arm_long_qtd_sup;
      v_arm_long_m  := v_arm_long_qtd * (v_l + v_gancho) * v_qtd;
      v_arm_long_kg := v_arm_long_m * power(v_arm_long_diam, 2) * 0.00617;
    END IF;
    IF v_arm_trans_diam > 0 AND v_arm_trans_esp > 0 AND v_b > 0 AND v_h > 0 THEN
      v_estribo_perim := 2*(v_b - 2*v_cob) + 2*(v_h - 2*v_cob) + 12.5*(v_arm_trans_diam/1000.0)*2;
      v_estribo_qtd   := ceil(v_l / v_arm_trans_esp) * v_qtd;
      v_arm_trans_m   := v_estribo_qtd * v_estribo_perim;
      v_arm_trans_kg  := v_arm_trans_m * power(v_arm_trans_diam, 2) * 0.00617;
    END IF;
    IF v_arm_long_m > 0 OR v_arm_trans_m > 0 THEN
      v_resumo_arm := ' | Long: ' || round(v_arm_long_kg::numeric,2)::text || 'kg | Estrib: ' || round(v_estribo_qtd::numeric,0)::text || 'un=' || round(v_arm_trans_kg::numeric,2)::text || 'kg';
    END IF;
    v_result := jsonb_build_object(
      'volume', round(v_vol::numeric, 4), 'unit', 'm3',
      'arm_long_m', round(v_arm_long_m::numeric,3), 'arm_long_kg', round(v_arm_long_kg::numeric,3),
      'arm_trans_m', round(v_arm_trans_m::numeric,3), 'arm_trans_kg', round(v_arm_trans_kg::numeric,3),
      'estribo_perimetro', round(v_estribo_perim::numeric,4), 'estribo_qtd', round(v_estribo_qtd::numeric,0),
      'resumo', round(v_vol::numeric,3)::text || ' m3' || v_resumo_arm
    );

  ELSIF p_element_type = 'pilar' THEN
    v_vol := v_b * v_l * v_h * v_qtd;
    IF v_arm_long_diam > 0 AND v_arm_long_qtd > 0 THEN
      v_gancho := 12.5 * (v_arm_long_diam / 1000.0);
      v_arm_long_m  := v_arm_long_qtd * (v_h + v_gancho) * v_qtd;
      v_arm_long_kg := v_arm_long_m * power(v_arm_long_diam, 2) * 0.00617;
    END IF;
    IF v_arm_trans_diam > 0 AND v_arm_trans_esp > 0 AND v_b > 0 AND v_l > 0 THEN
      v_estribo_perim := 2*(v_b - 2*v_cob) + 2*(v_l - 2*v_cob) + 12.5*(v_arm_trans_diam/1000.0)*2;
      v_estribo_qtd   := ceil(v_h / v_arm_trans_esp) * v_qtd;
      v_arm_trans_m   := v_estribo_qtd * v_estribo_perim;
      v_arm_trans_kg  := v_arm_trans_m * power(v_arm_trans_diam, 2) * 0.00617;
    END IF;
    IF v_arm_long_m > 0 OR v_arm_trans_m > 0 THEN
      v_resumo_arm := ' | Long: ' || round(v_arm_long_kg::numeric,2)::text || 'kg | Estrib: ' || round(v_estribo_qtd::numeric,0)::text || 'un x ' || round(v_estribo_perim::numeric,3)::text || 'm=' || round(v_arm_trans_kg::numeric,2)::text || 'kg';
    END IF;
    v_result := jsonb_build_object(
      'volume', round(v_vol::numeric, 4), 'unit', 'm3',
      'arm_long_m', round(v_arm_long_m::numeric,3), 'arm_long_kg', round(v_arm_long_kg::numeric,3),
      'arm_trans_m', round(v_arm_trans_m::numeric,3), 'arm_trans_kg', round(v_arm_trans_kg::numeric,3),
      'estribo_perimetro', round(v_estribo_perim::numeric,4), 'estribo_qtd', round(v_estribo_qtd::numeric,0),
      'resumo', round(v_vol::numeric,3)::text || ' m3' || v_resumo_arm
    );

  ELSIF p_element_type = 'laje' THEN
    v_vol  := v_b * v_l * v_e;
    v_area := v_b * v_l;
    IF v_arm_diam > 0 AND v_arm_esp > 0 AND v_b > 0 AND v_l > 0 THEN
      v_qtd_b_dir := ceil((v_l - 2*v_cob) / v_arm_esp) + 1;
      v_qtd_l_dir := ceil((v_b - 2*v_cob) / v_arm_esp) + 1;
      v_arm_long_m  := v_qtd_b_dir * (v_b - 2*v_cob) + v_qtd_l_dir * (v_l - 2*v_cob);
      v_arm_long_kg := v_arm_long_m * power(v_arm_diam, 2) * 0.00617;
      v_resumo_arm := ' | Malha: ' || round(v_qtd_b_dir::numeric,0)::text || '+' || round(v_qtd_l_dir::numeric,0)::text || ' barras=' || round(v_arm_long_kg::numeric,2)::text || 'kg';
    END IF;
    v_result := jsonb_build_object(
      'volume', round(v_vol::numeric, 4), 'area', round(v_area::numeric, 4), 'unit', 'm2',
      'arm_long_m', round(v_arm_long_m::numeric,3), 'arm_long_kg', round(v_arm_long_kg::numeric,3),
      'resumo', round(v_area::numeric,3)::text || ' m2 / ' || round(v_vol::numeric,3)::text || ' m3' || v_resumo_arm
    );

  ELSIF p_element_type = 'radier' THEN
    v_vol  := v_b * v_l * v_e;
    v_area := v_b * v_l;
    IF v_arm_diam > 0 AND v_arm_esp > 0 AND v_b > 0 AND v_l > 0 THEN
      v_qtd_b_dir := ceil((v_l - 2*v_cob) / v_arm_esp) + 1;
      v_qtd_l_dir := ceil((v_b - 2*v_cob) / v_arm_esp) + 1;
      v_arm_long_m  := v_qtd_b_dir * (v_b - 2*v_cob) + v_qtd_l_dir * (v_l - 2*v_cob);
      v_arm_long_kg := v_arm_long_m * power(v_arm_diam, 2) * 0.00617;
      v_resumo_arm := ' | Malha: ' || round(v_arm_long_m::numeric,2)::text || 'm=' || round(v_arm_long_kg::numeric,2)::text || 'kg';
    END IF;
    v_result := jsonb_build_object(
      'volume', round(v_vol::numeric, 4), 'area', round(v_area::numeric, 4), 'unit', 'm3',
      'arm_long_m', round(v_arm_long_m::numeric,3), 'arm_long_kg', round(v_arm_long_kg::numeric,3),
      'resumo', round(v_vol::numeric,3)::text || ' m3' || v_resumo_arm
    );

  ELSIF p_element_type = 'estaca' THEN
    v_vol  := pi() * power(v_d/2, 2) * v_h * v_qtd;
    IF v_arm_long_diam > 0 AND v_arm_long_qtd > 0 THEN
      v_arm_long_m  := v_arm_long_qtd * v_h * v_qtd;
      v_arm_long_kg := v_arm_long_m * power(v_arm_long_diam, 2) * 0.00617;
    END IF;
    IF v_arm_trans_diam > 0 AND v_arm_trans_esp > 0 AND v_d > 0 THEN
      v_estribo_perim := pi() * (v_d - 2*v_cob) + 12.5*(v_arm_trans_diam/1000.0)*2;
      v_estribo_qtd   := ceil(v_h / v_arm_trans_esp) * v_qtd;
      v_arm_trans_m   := v_estribo_qtd * v_estribo_perim;
      v_arm_trans_kg  := v_arm_trans_m * power(v_arm_trans_diam, 2) * 0.00617;
    END IF;
    IF v_arm_long_m > 0 OR v_arm_trans_m > 0 THEN
      v_resumo_arm := ' | Long: ' || round(v_arm_long_kg::numeric,2)::text || 'kg | Espiral: ' || round(v_estribo_qtd::numeric,0)::text || 'un=' || round(v_arm_trans_kg::numeric,2)::text || 'kg';
    END IF;
    v_result := jsonb_build_object(
      'volume', round(v_vol::numeric, 4), 'unit', 'm3',
      'arm_long_m', round(v_arm_long_m::numeric,3), 'arm_long_kg', round(v_arm_long_kg::numeric,3),
      'arm_trans_m', round(v_arm_trans_m::numeric,3), 'arm_trans_kg', round(v_arm_trans_kg::numeric,3),
      'estribo_perimetro', round(v_estribo_perim::numeric,4), 'estribo_qtd', round(v_estribo_qtd::numeric,0),
      'resumo', round(v_vol::numeric,3)::text || ' m3' || v_resumo_arm
    );

  ELSIF p_element_type = 'escada' THEN
    v_area := v_b * v_l;
    v_result := jsonb_build_object('area', round(v_area::numeric,4), 'unit', 'm2',
      'resumo', round(v_area::numeric,3)::text || ' m2');

  ELSIF p_element_type IN ('parede_alvenaria','parede_drywall','muro') THEN
    DECLARE v_ded float8; BEGIN
      v_ded  := coalesce((p_params->>'area_deducao')::float8, 0);
      v_area := greatest(v_b * v_l * v_qtd - v_ded, 0);
      v_result := jsonb_build_object('area', round(v_area::numeric,4), 'unit', 'm2',
        'resumo', round(v_area::numeric,3)::text || ' m2');
    END;

  ELSIF p_element_type IN ('porta','janela') THEN
    v_area := v_b * v_h * v_qtd;
    v_result := jsonb_build_object('area', round(v_area::numeric,4), 'unit', 'm2',
      'resumo', round(v_area::numeric,3)::text || ' m2');

  ELSIF p_element_type IN ('revestimento_piso','revestimento_parede','revestimento_teto','pintura') THEN
    v_area := v_b * v_l * v_qtd;
    v_result := jsonb_build_object('area', round(v_area::numeric,4), 'unit', 'm2',
      'resumo', round(v_area::numeric,3)::text || ' m2');

  ELSIF p_element_type IN ('cobertura','impermeabilizacao') THEN
    v_area := v_b * v_l;
    v_result := jsonb_build_object('area', round(v_area::numeric,4), 'unit', 'm2',
      'resumo', round(v_area::numeric,3)::text || ' m2');

  ELSIF p_element_type IN ('pavimentacao_asfalto','pavimentacao_concreto','pavimentacao_intertravado') THEN
    v_area := v_b * v_l;
    v_vol  := v_b * v_l * v_e;
    v_result := jsonb_build_object('area', round(v_area::numeric,4), 'volume', round(v_vol::numeric,4), 'unit', 'm2',
      'resumo', round(v_area::numeric,3)::text || ' m2 / ' || round(v_vol::numeric,3)::text || ' m3');

  ELSIF p_element_type = 'terraplanagem' THEN
    v_vol := v_b * v_l * v_h;
    v_result := jsonb_build_object('volume', round(v_vol::numeric,4), 'unit', 'm3',
      'resumo', round(v_vol::numeric,3)::text || ' m3');

  ELSIF p_element_type = 'drenagem' THEN
    DECLARE v_ml float8; BEGIN
      v_ml := v_l * v_qtd;
      v_result := jsonb_build_object('metro_linear', round(v_ml::numeric,4), 'unit', 'm',
        'resumo', round(v_ml::numeric,3)::text || ' m');
    END;

  ELSIF p_element_type IN ('instalacao_eletrica','instalacao_hidraulica','instalacao_gas') THEN
    v_result := jsonb_build_object('pontos', v_qtd, 'unit', 'pt',
      'resumo', v_qtd::text || ' pt');

  ELSIF p_element_type IN (
    'canteiro_obras','locacao_terreno','limpeza_terreno','tapume',
    'instalacoes_provisorias','bacia_sanitaria','pia_cozinha','lavatorio_cuba',
    'torneira_registro','chuveiro_ducha','tanque_lavanderia','item_louca_metal','outros'
  ) THEN
    DECLARE v_custo float8; BEGIN
      v_custo := coalesce((p_params->>'custo_unitario')::float8, 0);
      v_result := jsonb_build_object('quantidade', v_qtd, 'unit', 'un',
        'resumo', v_qtd::text || ' un');
    END;

  ELSE
    v_qtd := coalesce((p_params->>'quantidade')::float8, 1);
    v_result := jsonb_build_object('quantidade', v_qtd, 'unit', 'un',
      'resumo', v_qtd::text || ' un');
  END IF;

  RETURN v_result;
END;
$$;
