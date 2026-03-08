/*
  # Fix PRAD Prefilled Data View - Proper Handling of Multiple Rows

  1. Issue
    - The previous fix exposed an issue: multiple company_settings rows exist
    - Need to use LIMIT 1 to get first company settings, then remove other LIMIT 1s

  2. Changes
    - Keep LIMIT 1 on company_settings (is a configuration table, should have 1 row)
    - Fix the subquery to properly handle the single row

  3. Impact
    - Proper handling of company settings while fixing the cement_weight issue
*/

CREATE OR REPLACE VIEW prad_prefilled_data AS
SELECT 
  ep.id AS project_id,
  ep.name AS project_name,
  ep.property_id,
  ep.customer_id,
  c.name AS customer_name,
  c.cpf AS customer_document,
  c.person_type,
  TRIM(BOTH FROM COALESCE(((((NULLIF(c.street, ''::text) || ', '::text) || NULLIF(c.neighborhood, ''::text)) || ', '::text) || NULLIF(c.city, ''::text)), ((NULLIF(c.street, ''::text) || ', '::text) || NULLIF(c.city, ''::text)), NULLIF(c.city, ''::text), ''::text)) AS customer_address,
  c.city AS customer_city,
  c.phone,
  c.email,
  c.marital_status_type,
  c.spouse_name,
  c.spouse_cpf,
  p.name AS property_name,
  p.registration_number,
  p.property_type,
  p.municipality AS property_municipality,
  p.state AS property_state,
  p.ccir,
  p.car_receipt_code,
  p.municipal_registration,
  p.itr_cib,
  get_bioma_from_municipio(p.municipality) AS bioma,
  CASE
    WHEN (p.state = 'SC'::text) THEN 'Santa Catarina - Legislação: Lei 14.675/2009 (Código Ambiental de SC)'::text
    WHEN (p.state = 'PR'::text) THEN 'Paraná'::text
    WHEN (p.state = 'RS'::text) THEN 'Rio Grande do Sul'::text
    ELSE p.state
  END AS state_with_legislation,
  get_default_technical_responsible() AS default_technical_responsible,
  (
    SELECT company_settings.technical_responsibles
    FROM company_settings
    WHERE (company_settings.technical_responsibles IS NOT NULL)
    LIMIT 1
  ) AS available_technical_responsibles
FROM ((engineering_projects ep
  JOIN customers c ON ((ep.customer_id = c.id)))
  JOIN properties p ON ((ep.property_id = p.id)))
WHERE (ep.id IS NOT NULL);
