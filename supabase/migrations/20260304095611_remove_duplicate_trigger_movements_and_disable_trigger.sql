/*
  # Remove duplicate trigger-based material consumption movements

  ## Context
  The system has two mechanisms that create material consumption movements on production:
  1. A database trigger `trigger_process_material_consumption` that runs on INSERT to `production`
  2. The RPC function `create_production_atomic` which also creates consumption movements

  For 5 production records, BOTH mechanisms ran, creating duplicate `saida` movements.
  The RPC movements (notes: "Consumo da receita (proporcional ao peso)...") are the correct ones
  as they calculate proportionally based on product weight.
  
  The trigger movements (notes: "Consumo automático...") are the duplicates to be removed.

  ## Changes
  1. Delete trigger-based movements ONLY for productions that also have RPC movements (5 productions)
  2. Drop the trigger `trigger_process_material_consumption` from the `production` table
     to prevent future duplicates. The RPC already handles consumption correctly.

  ## Affected productions (5):
  - 8d405768-6729-48b3-9171-73bcf614a058
  - add75f66-739b-43af-9bef-62ca3396a564
  - 898be4a9-017a-493b-b436-4662f9242356
  - 89eaeadd-6070-40af-ab5d-aa0bb6821bea
  - f3b63eaa-f1f8-4638-a985-ee4a54102306
*/

-- Step 1: Delete ONLY the trigger-based duplicate movements for the 5 affected productions
DELETE FROM material_movements
WHERE notes LIKE 'Consumo automático%'
  AND movement_type = 'saida'
  AND production_id IN (
    '8d405768-6729-48b3-9171-73bcf614a058',
    'add75f66-739b-43af-9bef-62ca3396a564',
    '898be4a9-017a-493b-b436-4662f9242356',
    '89eaeadd-6070-40af-ab5d-aa0bb6821bea',
    'f3b63eaa-f1f8-4638-a985-ee4a54102306'
  );

-- Step 2: Drop the trigger that causes duplicates when using the RPC
-- Productions registered via the old direct-insert path will keep their trigger movements
-- (those 89 productions only have trigger movements, which is correct for them)
DROP TRIGGER IF EXISTS trigger_process_material_consumption ON production;
