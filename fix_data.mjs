import { createClient } from '/tmp/cc-agent/62467974/project/node_modules/@supabase/supabase-js/dist/index.mjs';

const SUPABASE_URL = 'https://lfddbmknscawlbldrmub.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmZGRibWtuc2Nhd2xibGRybXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMzYxNDAsImV4cCI6MjA4MzgxMjE0MH0.6DgLMrFKH0WQAs033Rrt6tn5Iwlq-oqayw4ZbmPJ7bA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let cashFlowCreated = 0;
const balanceFixed = [];
const totalAmountFixed = [];
const errors = [];

async function main() {
  console.log('Fetching all customer_revenue rows...');

  const { data: revenueRows, error: revenueError } = await supabase
    .from('customer_revenue')
    .select('*');

  if (revenueError) {
    console.error('Error fetching customer_revenue:', revenueError);
    errors.push({ step: 'fetch customer_revenue', error: revenueError });
    return;
  }

  console.log(`Found ${revenueRows.length} customer_revenue rows.`);

  for (const row of revenueRows) {
    // --- Step 3: Reconstruct missing cash_flow entries ---

    // Sum of credit_amount from customer_statement where revenue_id = row.id
    const { data: stmtData, error: stmtError } = await supabase
      .from('customer_statement')
      .select('credit_amount')
      .eq('revenue_id', row.id);

    if (stmtError) {
      console.error(`Error fetching customer_statement for revenue ${row.id}:`, stmtError);
      errors.push({ step: `fetch customer_statement for ${row.id}`, error: stmtError });
      continue;
    }

    const statementSum = (stmtData || []).reduce((acc, r) => acc + (parseFloat(r.credit_amount) || 0), 0);

    // Sum of amount from cash_flow where customer_revenue_id = row.id
    const { data: cfData, error: cfError } = await supabase
      .from('cash_flow')
      .select('id, amount')
      .eq('customer_revenue_id', row.id);

    if (cfError) {
      console.error(`Error fetching cash_flow for revenue ${row.id}:`, cfError);
      errors.push({ step: `fetch cash_flow for ${row.id}`, error: cfError });
      continue;
    }

    const cashFlowSum = (cfData || []).reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);

    const diff = statementSum - cashFlowSum;

    if (diff > 0.01) {
      const category = row.origin_type === 'construction_work' ? 'Receita de Obra' : 'Receita de Venda';
      const businessUnit = row.origin_type === 'construction_work' ? 'construction' : 'factory';
      const paymentMethod = row.payment_method || 'outros';
      const description = 'Recebimento (reconstruido): ' + (row.origin_description || '');
      const date = row.payment_date || new Date().toISOString().split('T')[0];

      console.log(`Processing cash_flow for revenue ${row.id}: diff=${diff.toFixed(2)}, existing cash_flow rows=${(cfData || []).length}`);

      if ((cfData || []).length === 0) {
        // No existing cash_flow row — INSERT a new one
        const newEntry = {
          type: 'income',
          category,
          amount: diff,
          description,
          date,
          payment_method: paymentMethod,
          business_unit: businessUnit,
          customer_revenue_id: row.id,
        };

        const { error: insertError } = await supabase
          .from('cash_flow')
          .insert(newEntry);

        if (insertError) {
          console.error(`Error inserting cash_flow for revenue ${row.id}:`, insertError);
          errors.push({ step: `insert cash_flow for ${row.id}`, error: insertError });
        } else {
          cashFlowCreated++;
          console.log(`  -> Inserted new cash_flow entry (amount=${diff.toFixed(2)}) for revenue ${row.id}`);
        }
      } else {
        // Existing cash_flow row(s) present but sum is less than statement sum.
        // The unique constraint allows only one row per customer_revenue_id, so
        // UPDATE the existing row: new amount = existing amount + diff.
        // cfData already contains id and amount from the earlier fetch.
        for (const cf of cfData) {
          const updatedAmount = (parseFloat(cf.amount) || 0) + diff;
          const { error: updateCfError } = await supabase
            .from('cash_flow')
            .update({ amount: updatedAmount, description, category, business_unit: businessUnit })
            .eq('id', cf.id);

          if (updateCfError) {
            console.error(`Error updating cash_flow ${cf.id} for revenue ${row.id}:`, updateCfError);
            errors.push({ step: `update cash_flow ${cf.id} for ${row.id}`, error: updateCfError });
          } else {
            cashFlowCreated++;
            console.log(`  -> Updated cash_flow ${cf.id}: old amount=${cf.amount}, added diff=${diff.toFixed(2)}, new amount=${updatedAmount.toFixed(2)}`);
          }
        }
      }
    }

    // --- Step 4: Fix negative balances ---
    if (parseFloat(row.balance) < 0) {
      console.log(`Fixing negative balance for revenue ${row.id}: balance=${row.balance}`);

      const { error: updateError } = await supabase
        .from('customer_revenue')
        .update({ balance: 0 })
        .eq('id', row.id);

      if (updateError) {
        console.error(`Error updating balance for revenue ${row.id}:`, updateError);
        errors.push({ step: `update balance for ${row.id}`, error: updateError });
      } else {
        balanceFixed.push({ id: row.id, old_balance: row.balance });
        console.log(`  -> Balance fixed to 0 for revenue ${row.id}`);
      }
    }

    // --- Step 5: Fix total_amount for the specific row starting with 2c5469cf ---
    if (row.id.startsWith('2c5469cf') && (parseFloat(row.total_amount) === 0 || row.total_amount === null)) {
      console.log(`Found special row ${row.id} with total_amount=${row.total_amount}, origin_type=${row.origin_type}, origin_id=${row.origin_id}`);

      let contractValue = null;

      if (row.origin_id) {
        const { data: cwData, error: cwError } = await supabase
          .from('construction_works')
          .select('total_contract_value')
          .eq('id', row.origin_id)
          .single();

        if (cwError) {
          console.error(`Error fetching construction_work for revenue ${row.id}:`, cwError);
          errors.push({ step: `fetch construction_work for ${row.id}`, error: cwError });
        } else if (cwData) {
          contractValue = parseFloat(cwData.total_contract_value);
          console.log(`  -> Found total_contract_value=${contractValue}`);
        }
      }

      if (contractValue !== null && contractValue > 0) {
        const paid = parseFloat(row.paid_amount) || 0;
        const newBalance = contractValue - paid;

        const { error: updateError } = await supabase
          .from('customer_revenue')
          .update({ total_amount: contractValue, balance: newBalance })
          .eq('id', row.id);

        if (updateError) {
          console.error(`Error updating total_amount for revenue ${row.id}:`, updateError);
          errors.push({ step: `update total_amount for ${row.id}`, error: updateError });
        } else {
          totalAmountFixed.push({
            id: row.id,
            old_total_amount: row.total_amount,
            new_total_amount: contractValue,
            old_balance: row.balance,
            new_balance: newBalance,
          });
          console.log(`  -> total_amount updated to ${contractValue}, balance updated to ${newBalance} for revenue ${row.id}`);
        }
      } else {
        console.log(`  -> Could not determine contract value for ${row.id}, skipping total_amount fix.`);
      }
    }
  }

  // --- Summary ---
  console.log('\n========== SUMMARY ==========');
  console.log(`Cash flow entries created: ${cashFlowCreated}`);

  if (balanceFixed.length > 0) {
    console.log(`\nCustomer revenue rows with balance fixed to 0 (${balanceFixed.length}):`);
    for (const r of balanceFixed) {
      console.log(`  - id=${r.id}, old_balance=${r.old_balance}`);
    }
  } else {
    console.log('\nNo customer_revenue rows needed balance fix.');
  }

  if (totalAmountFixed.length > 0) {
    console.log(`\nCustomer revenue rows with total_amount fixed (${totalAmountFixed.length}):`);
    for (const r of totalAmountFixed) {
      console.log(`  - id=${r.id}, old_total_amount=${r.old_total_amount} -> ${r.new_total_amount}, old_balance=${r.old_balance} -> ${r.new_balance}`);
    }
  } else {
    console.log('\nNo customer_revenue rows needed total_amount fix (or row not found).');
  }

  if (errors.length > 0) {
    console.log(`\nErrors encountered (${errors.length}):`);
    for (const e of errors) {
      console.log(`  - [${e.step}]:`, JSON.stringify(e.error));
    }
  } else {
    console.log('\nNo errors encountered.');
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
