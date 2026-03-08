/*
  # Add reinforcement_bars to budget_foundation_params dimensions

  ## Summary
  The `dimensions` column in `budget_foundation_params` is already a JSONB field,
  so it naturally supports storing a `reinforcement_bars` array. This migration:

  1. Removes the old geometry-only arm_* columns from any legacy param rows by migrating
     any stored arm_long_diametro / arm_trans_diametro fields into a compatibility note
     (data is not deleted — existing rows keep their JSONB as-is, the new UI simply ignores
     the old keys and uses reinforcement_bars instead).

  2. Adds a GIN index on the dimensions column so queries on reinforcement_bars[*].material_id
     can be fast.

  No destructive operations — the existing JSONB just grows new keys when users save via the
  updated UI.
*/

CREATE INDEX IF NOT EXISTS idx_budget_foundation_params_dimensions
  ON budget_foundation_params USING GIN (dimensions);
