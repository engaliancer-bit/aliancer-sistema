/*
  # Fix Areia industrial: unit cost, resale price, and incorrect purchase quantities

  ## Context
  "Areia industrial" is purchased in tons (R$ 68/ton) but consumed and stocked in kg.
  The unit_cost was stored as 68 (price per ton) instead of 0.068 (price per kg).
  The resale_price was stored as 102.22 (price per ton) instead of 0.10222 (price per kg).

  Additionally, 5 purchase (entrada) movements recorded the quantity in tons instead of kg,
  causing the stock balance to be understated by ~88,810 kg.

  ## Changes
  1. Fix unit_cost: 68.00 -> 0.068 (R$ 68/ton ÷ 1000 kg/ton)
  2. Fix resale_price: 102.22 -> 0.10222 (R$ 102.22/ton ÷ 1000 kg/ton)
  3. Fix 5 entrada movements where quantity was entered in tons instead of kg:
     - 2026-02-26: 24.85 -> 24,850 kg (24.85 tons)
     - 2026-02-12: 19.77 -> 19,770 kg (19.77 tons)
     - 2026-02-11: 19.09 -> 19,090 kg (19.09 tons)
     - 2026-02-04: 1.00  -> 1,000 kg (1 ton)
     - 2026-01-13: 25.07 -> 25,070 kg (25.07 tons)
*/

-- Step 1: Fix unit_cost and resale_price for Areia industrial
UPDATE materials
SET 
  unit_cost    = 0.068,
  resale_price = 0.10222
WHERE LOWER(name) = 'areia industrial';

-- Step 2: Fix the 5 entrada movements where quantity was entered in tons instead of kg
-- Each is multiplied by 1000 to convert tons -> kg
UPDATE material_movements
SET quantity = quantity * 1000
WHERE id IN (
  'ec8ee0bb-0717-4e42-a873-982e4415ffd5',  -- 24.85 ton -> 24,850 kg  (NF 28083/1)
  '54674f9b-398e-4b79-a43f-2f913d3da8b5',  -- 19.77 ton -> 19,770 kg  (NF 27629-1)
  '70534c80-7854-40e8-8928-87ad79d9b2c0',  -- 19.09 ton -> 19,090 kg  (NF 5658/1)
  '3bc7682c-6535-4eba-b5dd-f2833c153e9a',  --  1.00 ton ->  1,000 kg  (NF N/A)
  '38c3e81f-305f-4dee-99d4-7b29f606bedc'   -- 25.07 ton -> 25,070 kg  (NF 5476/1)
);
