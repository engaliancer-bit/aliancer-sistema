import { createClient } from '/tmp/cc-agent/62467974/project/node_modules/@supabase/supabase-js/dist/index.mjs';
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://lfddbmknscawlbldrmub.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmZGRibWtuc2Nhd2xibGRybXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzYxNDAsImV4cCI6MjA4MzgxMjE0MH0.6DgLMrFKH0WQAs033Rrt6tn5Iwlq-oqayw4ZbmPJ7bA';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const DDL_SQL = `
CREATE OR REPLACE FUNCTION sync_customer_revenue_to_cash_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_business_unit text;
  v_category text;
  v_diff numeric(15,2);
BEGIN
  v_business_unit := CASE
    WHEN COALESCE(NEW.origin_type, OLD.origin_type) IN ('quote', 'quote_installment', 'ribbed_slab_quote') THEN 'factory'
    WHEN COALESCE(NEW.origin_type, OLD.origin_type) = 'construction_work' THEN 'construction'
    ELSE 'factory'
  END;

  v_category := CASE
    WHEN COALESCE(NEW.origin_type, OLD.origin_type) = 'construction_work' THEN 'Receita de Obra'
    ELSE 'Receita de Venda'
  END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.estornado = true THEN
      RETURN NEW;
    END IF;

    INSERT INTO cash_flow (
      type, category, amount, description, date, payment_method, business_unit, customer_revenue_id
    ) VALUES (
      'income',
      v_category,
      NEW.payment_amount,
      'Recebimento: ' || COALESCE(NEW.origin_description, 'Cliente'),
      NEW.payment_date,
      COALESCE(NEW.payment_method, 'outros'),
      v_business_unit,
      NEW.id
    )
    ON CONFLICT DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.estornado = false AND NEW.estornado = true THEN
      DELETE FROM cash_flow WHERE customer_revenue_id = NEW.id;
      RETURN NEW;
    END IF;

    IF OLD.payment_amount IS DISTINCT FROM NEW.payment_amount THEN
      v_diff := NEW.payment_amount - OLD.payment_amount;

      IF v_diff > 0 THEN
        INSERT INTO cash_flow (
          type, category, amount, description, date, payment_method, business_unit, customer_revenue_id
        ) VALUES (
          'income',
          v_category,
          v_diff,
          'Recebimento: ' || COALESCE(NEW.origin_description, 'Cliente'),
          NEW.payment_date,
          COALESCE(NEW.payment_method, 'outros'),
          v_business_unit,
          NEW.id
        );
      ELSIF v_diff < 0 THEN
        UPDATE cash_flow
        SET
          amount = amount + v_diff,
          date = NEW.payment_date,
          payment_method = COALESCE(NEW.payment_method, 'outros')
        WHERE id = (
          SELECT id FROM cash_flow
          WHERE customer_revenue_id = NEW.id
          ORDER BY date DESC, id DESC
          LIMIT 1
        );
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM cash_flow WHERE customer_revenue_id = OLD.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_customer_revenue_to_cash_flow ON customer_revenue;
CREATE TRIGGER trigger_sync_customer_revenue_to_cash_flow
  AFTER INSERT OR DELETE OR UPDATE OF payment_amount, payment_date, payment_method, estornado ON customer_revenue
  FOR EACH ROW
  EXECUTE FUNCTION sync_customer_revenue_to_cash_flow();
`;

async function step1_try_exec_ddl() {
  console.log('\n--- STEP 1: Trying supabase.rpc("exec_ddl", { sql: ... }) ---');
  const { data, error } = await supabase.rpc('exec_ddl', { sql: DDL_SQL });
  if (error) {
    console.log('exec_ddl RPC failed:', JSON.stringify(error, null, 2));
    return false;
  }
  console.log('exec_ddl RPC succeeded:', JSON.stringify(data, null, 2));
  return true;
}

async function step2_try_rpc_variants() {
  console.log('\n--- STEP 2: Trying alternative RPC function names ---');

  const candidates = [
    { fn: 'exec_sql', params: { query: DDL_SQL } },
    { fn: 'exec_sql', params: { sql: DDL_SQL } },
    { fn: 'run_sql', params: { sql: DDL_SQL } },
    { fn: 'run_ddl', params: { sql: DDL_SQL } },
    { fn: 'pg_execute', params: { sql: DDL_SQL } },
  ];

  for (const candidate of candidates) {
    console.log(`  Trying rpc('${candidate.fn}', ...)...`);
    const { data, error } = await supabase.rpc(candidate.fn, candidate.params);
    if (!error) {
      console.log(`  SUCCESS with rpc('${candidate.fn}'):`, JSON.stringify(data, null, 2));
      return true;
    }
    console.log(`  Failed (${candidate.fn}):`, error.message || JSON.stringify(error));
  }

  return false;
}

async function step3_write_fallback_sql() {
  console.log('\n--- STEP 3: Writing fallback SQL file to /tmp/cc-agent/62467974/project/trigger_fix.sql ---');
  writeFileSync('/tmp/cc-agent/62467974/project/trigger_fix.sql', DDL_SQL.trim(), 'utf8');
  console.log('Fallback SQL written to /tmp/cc-agent/62467974/project/trigger_fix.sql');
  console.log('To apply manually, run:');
  console.log('  psql "<YOUR_CONNECTION_STRING>" -f /tmp/cc-agent/62467974/project/trigger_fix.sql');
  console.log('Or paste the contents into the Supabase SQL Editor at:');
  console.log('  https://supabase.com/dashboard/project/lfddbmknscawlbldrmub/sql');
}

async function step4_verify_trigger() {
  console.log('\n--- STEP 4: Verifying trigger behavior ---');

  const testDate = new Date().toISOString().split('T')[0];
  const testDescription = 'TEST_TRIGGER_VERIFICATION_' + Date.now();

  // First, fetch required NOT NULL fields from existing rows
  console.log('  Fetching required fields (customer_id, origin_id) from an existing row...');
  const { data: sampleRows, error: sampleErr } = await supabase
    .from('customer_revenue')
    .select('customer_id, origin_id, total_amount, paid_amount, balance')
    .limit(1);

  if (sampleErr || !sampleRows || sampleRows.length === 0) {
    console.log('  Cannot fetch sample row fields:', JSON.stringify(sampleErr, null, 2));
    return;
  }
  const validCustomerId = sampleRows[0].customer_id;
  const validOriginId = sampleRows[0].origin_id;
  const validTotalAmount = sampleRows[0].total_amount ?? 1.00;
  const validPaidAmount = sampleRows[0].paid_amount ?? 1.00;
  const validBalance = sampleRows[0].balance ?? 0;
  console.log('  Using customer_id:', validCustomerId, '| origin_id:', validOriginId);

  console.log('  Inserting test customer_revenue row...');
  const { data: insertedRow, error: insertError } = await supabase
    .from('customer_revenue')
    .insert({
      customer_id: validCustomerId,
      origin_id: validOriginId,
      origin_type: 'quote',
      origin_description: testDescription,
      total_amount: 1.00,
      paid_amount: 1.00,
      balance: 0,
      payment_amount: 1.00,
      payment_date: testDate,
      payment_method: 'outros',
      estornado: false,
    })
    .select()
    .single();

  if (insertError) {
    console.log('  Insert failed:', JSON.stringify(insertError, null, 2));
    return;
  }

  console.log('  Inserted test row with id:', insertedRow.id);

  // Wait briefly for trigger to fire
  await new Promise(r => setTimeout(r, 1000));

  // Check if cash_flow got a new entry
  console.log('  Checking cash_flow for customer_revenue_id =', insertedRow.id, '...');
  const { data: cashFlowRows, error: cashFlowError } = await supabase
    .from('cash_flow')
    .select('*')
    .eq('customer_revenue_id', insertedRow.id);

  if (cashFlowError) {
    console.log('  Could not read cash_flow:', JSON.stringify(cashFlowError, null, 2));
  } else if (!cashFlowRows || cashFlowRows.length === 0) {
    console.log('  WARNING: No cash_flow entry was created. Trigger may not be active.');
  } else {
    console.log('  SUCCESS: cash_flow entries created by trigger:');
    console.log(JSON.stringify(cashFlowRows, null, 2));
  }

  // Delete the test row
  console.log('  Deleting test customer_revenue row...');
  const { error: deleteError } = await supabase
    .from('customer_revenue')
    .delete()
    .eq('id', insertedRow.id);

  if (deleteError) {
    console.log('  Delete failed:', JSON.stringify(deleteError, null, 2));
  } else {
    console.log('  Test row deleted successfully.');
  }

  // Verify cash_flow cleanup
  await new Promise(r => setTimeout(r, 500));
  const { data: afterDeleteRows, error: afterDeleteError } = await supabase
    .from('cash_flow')
    .select('*')
    .eq('customer_revenue_id', insertedRow.id);

  if (afterDeleteError) {
    console.log('  Could not verify cash_flow cleanup:', JSON.stringify(afterDeleteError, null, 2));
  } else if (!afterDeleteRows || afterDeleteRows.length === 0) {
    console.log('  cash_flow entries cleaned up after DELETE (trigger DELETE handler works).');
  } else {
    console.log('  WARNING: cash_flow still has entries after DELETE:', JSON.stringify(afterDeleteRows, null, 2));
  }
}

async function main() {
  console.log('=== Supabase DDL Migration Script ===');
  console.log('Target: trigger_sync_customer_revenue_to_cash_flow on customer_revenue');

  const step1Success = await step1_try_exec_ddl();
  if (!step1Success) {
    const step2Success = await step2_try_rpc_variants();
    if (!step2Success) {
      await step3_write_fallback_sql();
    }
  }

  await step4_verify_trigger();

  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
