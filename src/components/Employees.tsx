import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Clock, DollarSign, Check, SkipForward, AlertCircle, X } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  role: string;
  base_salary: number;
  benefits: number;
  hire_date: string;
  active: boolean;
  employment_type: 'CLT' | 'Pro-labore';
}

interface OvertimeRecord {
  id: string;
  employee_id: string;
  hours: number;
  rate_multiplier: number;
  date: string;
}

interface PayrollCharge {
  id: string;
  name: string;
  percentage: number;
  description: string;
  active: boolean;
}

interface MonthlyExtraPayment {
  id: string;
  employee_id: string;
  month: string;
  payment_type: '13th_full' | '13th_half' | 'vacation';
  vacation_days: number;
  amount: number;
}

interface SalaryEntry {
  cash_flow_id: string | null;
  employee_id: string;
  employee_name: string;
  base_salary: number;
  adjusted_amount: number;
  due_date: string;
  status: 'pending' | 'confirmed' | 'skipped';
  description: string;
  notes: string;
}

const PESSOAL_CATEGORY_ID = 'c415f5bd-959f-46bd-b497-008506007959';

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([]);
  const [payrollCharges, setPayrollCharges] = useState<PayrollCharge[]>([]);
  const [monthlyExtraPayments, setMonthlyExtraPayments] = useState<MonthlyExtraPayment[]>([]);
  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showOvertimeForm, setShowOvertimeForm] = useState(false);
  const [showExtraPaymentForm, setShowExtraPaymentForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [editingEntry, setEditingEntry] = useState<SalaryEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [savingEntry, setSavingEntry] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    base_salary: '',
    benefits: '',
    hire_date: new Date().toISOString().split('T')[0],
    employment_type: 'CLT' as 'CLT' | 'Pro-labore',
  });

  const [overtimeData, setOvertimeData] = useState({
    employee_id: '',
    hours: '',
    rate_multiplier: '1.5',
    date: new Date().toISOString().split('T')[0],
  });

  const [extraPaymentData, setExtraPaymentData] = useState({
    employee_id: '',
    payment_type: '13th_full' as '13th_full' | '13th_half' | 'vacation',
    vacation_days: '',
  });

  useEffect(() => {
    loadEmployees();
    loadOvertimeRecords();
    loadPayrollCharges();
    loadMonthlyExtraPayments();
  }, [selectedMonth]);

  useEffect(() => {
    if (employees.length > 0) {
      loadSalaryEntries();
    }
  }, [employees, selectedMonth]);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading employees:', error);
      return;
    }

    setEmployees(data || []);
  }

  async function loadOvertimeRecords() {
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-31`;

    const { data, error } = await supabase
      .from('overtime_records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error loading overtime records:', error);
      return;
    }

    setOvertimeRecords(data || []);
  }

  async function loadPayrollCharges() {
    const { data, error } = await supabase
      .from('payroll_charges')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('Error loading payroll charges:', error);
      return;
    }

    setPayrollCharges(data || []);
  }

  async function loadMonthlyExtraPayments() {
    const { data, error } = await supabase
      .from('monthly_extra_payments')
      .select('*')
      .eq('month', selectedMonth)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading monthly extra payments:', error);
      return;
    }

    setMonthlyExtraPayments(data || []);
  }

  const loadSalaryEntries = useCallback(async () => {
    setLoadingSalary(true);
    const [year, month] = selectedMonth.split('-').map(Number);
    const dueDate = `${selectedMonth}-05`;

    const activeEmployees = employees.filter(e => e.active && (!(e as any).business_unit || (e as any).business_unit === 'factory'));

    const referencePattern = `SALARIO-%-${selectedMonth}`;
    const { data: existing, error } = await supabase
      .from('cash_flow')
      .select('id, description, amount, reference, payment_status, notes, due_date')
      .eq('business_unit', 'factory')
      .eq('type', 'expense')
      .like('reference', referencePattern);

    if (error) {
      console.error('Error loading salary entries:', error);
      setLoadingSalary(false);
      return;
    }

    const existingMap: Record<string, any> = {};
    for (const row of (existing || [])) {
      if (row.reference) {
        existingMap[row.reference] = row;
      }
    }

    const entries: SalaryEntry[] = activeEmployees.map(emp => {
      const ref = `SALARIO-${emp.id}-${selectedMonth}`;
      const existingRow = existingMap[ref];
      const monthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      if (existingRow) {
        const isSkipped = existingRow.payment_status === 'skipped';
        return {
          cash_flow_id: existingRow.id,
          employee_id: emp.id,
          employee_name: emp.name,
          base_salary: emp.base_salary,
          adjusted_amount: existingRow.amount,
          due_date: existingRow.due_date || dueDate,
          status: isSkipped ? 'skipped' : 'confirmed',
          description: existingRow.description,
          notes: existingRow.notes || '',
        };
      }

      return {
        cash_flow_id: null,
        employee_id: emp.id,
        employee_name: emp.name,
        base_salary: emp.base_salary,
        adjusted_amount: emp.base_salary,
        due_date: dueDate,
        status: 'pending',
        description: `Salario - ${emp.name} - ${monthLabel}`,
        notes: '',
      };
    });

    setSalaryEntries(entries);
    setLoadingSalary(false);
  }, [employees, selectedMonth]);

  async function handleConfirmSalary(entry: SalaryEntry, amount: number, notes: string) {
    setSavingEntry(entry.employee_id);
    const ref = `SALARIO-${entry.employee_id}-${selectedMonth}`;
    const monthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const description = `Salario - ${entry.employee_name} - ${monthLabel}`;

    try {
      if (entry.cash_flow_id) {
        const { error } = await supabase
          .from('cash_flow')
          .update({
            amount,
            description,
            notes,
            payment_status: 'pendente',
            due_date: entry.due_date,
          })
          .eq('id', entry.cash_flow_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cash_flow')
          .insert([{
            type: 'expense',
            description,
            amount,
            date: entry.due_date,
            due_date: entry.due_date,
            business_unit: 'factory',
            reference: ref,
            payment_status: 'pendente',
            category: 'pessoal',
            cost_category_id: PESSOAL_CATEGORY_ID,
            notes,
          }]);

        if (error) throw error;
      }

      await loadSalaryEntries();
    } catch (err) {
      console.error('Error confirming salary:', err);
    } finally {
      setSavingEntry(null);
      setEditingEntry(null);
    }
  }

  async function handleSkipSalary(entry: SalaryEntry) {
    if (!confirm(`Tem certeza que deseja pular o salário de ${entry.employee_name} para este mês?`)) return;
    setSavingEntry(entry.employee_id);
    const ref = `SALARIO-${entry.employee_id}-${selectedMonth}`;
    const monthLabel = new Date(`${selectedMonth}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    try {
      if (entry.cash_flow_id) {
        const { error } = await supabase
          .from('cash_flow')
          .update({ payment_status: 'skipped', amount: 0 })
          .eq('id', entry.cash_flow_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cash_flow')
          .insert([{
            type: 'expense',
            description: `Salario - ${entry.employee_name} - ${monthLabel} (Pulado)`,
            amount: 0,
            date: entry.due_date,
            due_date: entry.due_date,
            business_unit: 'factory',
            reference: ref,
            payment_status: 'skipped',
            category: 'pessoal',
            cost_category_id: PESSOAL_CATEGORY_ID,
          }]);
        if (error) throw error;
      }
      await loadSalaryEntries();
    } catch (err) {
      console.error('Error skipping salary:', err);
    } finally {
      setSavingEntry(null);
    }
  }

  async function handleDeleteSalaryEntry(entry: SalaryEntry) {
    if (!entry.cash_flow_id) return;
    if (!confirm(`Remover o lançamento de salário de ${entry.employee_name}? O colaborador voltará ao status "Pendente" para este mês.`)) return;

    setSavingEntry(entry.employee_id);
    const { error } = await supabase
      .from('cash_flow')
      .delete()
      .eq('id', entry.cash_flow_id);

    if (error) {
      console.error('Error deleting salary entry:', error);
    } else {
      await loadSalaryEntries();
    }
    setSavingEntry(null);
  }

  async function handleSubmitEmployee(e: React.FormEvent) {
    e.preventDefault();

    const employeeData = {
      name: formData.name,
      role: formData.role,
      base_salary: parseFloat(formData.base_salary),
      benefits: parseFloat(formData.benefits),
      hire_date: formData.hire_date,
      employment_type: formData.employment_type,
    };

    if (editingEmployee) {
      const { error } = await supabase
        .from('employees')
        .update(employeeData)
        .eq('id', editingEmployee.id);

      if (error) {
        console.error('Error updating employee:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('employees')
        .insert([employeeData]);

      if (error) {
        console.error('Error creating employee:', error);
        return;
      }
    }

    setFormData({
      name: '',
      role: '',
      base_salary: '',
      benefits: '',
      hire_date: new Date().toISOString().split('T')[0],
      employment_type: 'CLT',
    });
    setEditingEmployee(null);
    setShowEmployeeForm(false);
    loadEmployees();
  }

  async function handleSubmitOvertime(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase
      .from('overtime_records')
      .insert([{
        employee_id: overtimeData.employee_id,
        hours: parseFloat(overtimeData.hours),
        rate_multiplier: parseFloat(overtimeData.rate_multiplier),
        date: overtimeData.date,
      }]);

    if (error) {
      console.error('Error creating overtime record:', error);
      return;
    }

    setOvertimeData({
      employee_id: '',
      hours: '',
      rate_multiplier: '1.5',
      date: new Date().toISOString().split('T')[0],
    });
    setShowOvertimeForm(false);
    loadOvertimeRecords();
  }

  async function handleSubmitExtraPayment(e: React.FormEvent) {
    e.preventDefault();

    const employee = employees.find(emp => emp.id === extraPaymentData.employee_id);
    if (!employee) return;

    let amount = 0;

    if (extraPaymentData.payment_type === '13th_full') {
      amount = employee.base_salary;
    } else if (extraPaymentData.payment_type === '13th_half') {
      amount = employee.base_salary / 2;
    } else if (extraPaymentData.payment_type === 'vacation') {
      const vacationDays = parseFloat(extraPaymentData.vacation_days);
      amount = (employee.base_salary / 30) * vacationDays * (1 + 1/3);
    }

    const { error } = await supabase
      .from('monthly_extra_payments')
      .insert([{
        employee_id: extraPaymentData.employee_id,
        month: selectedMonth,
        payment_type: extraPaymentData.payment_type,
        vacation_days: extraPaymentData.payment_type === 'vacation' ? parseFloat(extraPaymentData.vacation_days) : 0,
        amount: amount,
      }]);

    if (error) {
      console.error('Error creating extra payment:', error);
      return;
    }

    setExtraPaymentData({
      employee_id: '',
      payment_type: '13th_full',
      vacation_days: '',
    });
    setShowExtraPaymentForm(false);
    loadMonthlyExtraPayments();
  }

  async function handleDeleteEmployee(id: string) {
    if (!confirm('Tem certeza que deseja excluir este colaborador?')) return;

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting employee:', error);
      return;
    }

    loadEmployees();
  }

  async function handleDeleteOvertime(id: string) {
    if (!confirm('Tem certeza que deseja excluir este registro de hora extra?')) return;

    const { error } = await supabase
      .from('overtime_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting overtime record:', error);
      return;
    }

    loadOvertimeRecords();
  }

  async function handleDeleteExtraPayment(id: string) {
    if (!confirm('Tem certeza que deseja excluir este pagamento extra?')) return;

    const { error } = await supabase
      .from('monthly_extra_payments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting extra payment:', error);
      return;
    }

    loadMonthlyExtraPayments();
  }

  function calculateMonthlyTotalCost(employee: Employee): number {
    const baseSalary = employee.base_salary;
    const benefits = employee.benefits;

    const overtimeForEmployee = overtimeRecords
      .filter(ot => ot.employee_id === employee.id);

    const hourlyRate = baseSalary / 220;
    const overtimeCost = overtimeForEmployee.reduce(
      (sum, ot) => sum + (hourlyRate * ot.hours * ot.rate_multiplier),
      0
    );

    const inssPercentage = employee.employment_type === 'CLT' ? 11 : 20;

    const chargesTotal = employee.employment_type === 'CLT'
      ? payrollCharges
          .filter(charge => charge.name !== 'INSS Empresa')
          .reduce((sum, charge) => sum + (baseSalary * charge.percentage / 100), 0)
      : 0;

    const inssTotal = baseSalary * inssPercentage / 100;

    const extraPayments = monthlyExtraPayments
      .filter(payment => payment.employee_id === employee.id)
      .reduce((sum, payment) => sum + payment.amount, 0);

    return baseSalary + benefits + overtimeCost + chargesTotal + inssTotal + extraPayments;
  }

  function calculateTotalPayroll(): number {
    return employees
      .filter(emp => emp.active)
      .reduce((sum, emp) => sum + calculateMonthlyTotalCost(emp), 0);
  }

  const pendingCount = salaryEntries.filter(e => e.status === 'pending').length;
  const confirmedCount = salaryEntries.filter(e => e.status === 'confirmed').length;
  const confirmedTotal = salaryEntries
    .filter(e => e.status === 'confirmed')
    .reduce((s, e) => s + e.adjusted_amount, 0);

  const monthDisplayLabel = new Date(`${selectedMonth}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Colaboradores</h2>
          <p className="text-gray-600">Gerencie colaboradores, salários e encargos</p>
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null);
            setFormData({
              name: '',
              role: '',
              base_salary: '',
              benefits: '',
              hire_date: new Date().toISOString().split('T')[0],
              employment_type: 'CLT',
            });
            setShowEmployeeForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="w-5 h-5" />
          Novo Colaborador
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Encargos Sociais Configurados</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {payrollCharges.map((charge) => (
            <div key={charge.id} className="border border-gray-200 rounded-lg p-4">
              <div className="font-medium text-gray-900">{charge.name}</div>
              <div className="text-2xl font-bold text-blue-600">{charge.percentage}%</div>
              {charge.description && (
                <div className="text-sm text-gray-500 mt-1">{charge.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período para cálculo
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Custo Total de Folha</div>
            <div className="text-3xl font-bold text-blue-600">
              R$ {calculateTotalPayroll().toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {showEmployeeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingEmployee ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h3>
            <form onSubmit={handleSubmitEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo
                </label>
                <input
                  type="text"
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salário Base (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.base_salary}
                  onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Benefícios (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Regime de Contratação
                </label>
                <select
                  value={formData.employment_type}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as 'CLT' | 'Pro-labore' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="CLT">CLT (INSS 11%)</option>
                  <option value="Pro-labore">Pró-labore (INSS 20%)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Admissão
                </label>
                <input
                  type="date"
                  required
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] shadow-sm hover:shadow-md transition-all"
                >
                  {editingEmployee ? 'Atualizar' : 'Cadastrar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmployeeForm(false);
                    setEditingEmployee(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cargo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Regime
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Salário Base
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Benefícios
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Custo Total/Mês
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.filter(emp => emp.active).map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{employee.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{employee.role}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      employee.employment_type === 'CLT'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {employee.employment_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    R$ {employee.base_salary.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    R$ {employee.benefits.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">
                    R$ {calculateMonthlyTotalCost(employee).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setEditingEmployee(employee);
                          setFormData({
                            name: employee.name,
                            role: employee.role,
                            base_salary: employee.base_salary.toString(),
                            benefits: employee.benefits.toString(),
                            hire_date: employee.hire_date,
                            employment_type: employee.employment_type,
                          });
                          setShowEmployeeForm(true);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(employee.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Folha Salarial do Mês */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Folha Salarial — {monthDisplayLabel}
                </h3>
                <p className="text-sm text-gray-500">
                  Vencimento: dia 05 • Despesa lançada automaticamente no Financeiro ao confirmar
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {pendingCount > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
                </span>
              )}
              {confirmedCount > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-medium">
                  <Check className="w-3.5 h-3.5" />
                  {confirmedCount} confirmado{confirmedCount > 1 ? 's' : ''} — R$ {confirmedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
        </div>

        {loadingSalary ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            <span className="ml-3 text-gray-500">Carregando folha...</span>
          </div>
        ) : salaryEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <DollarSign className="w-10 h-10 mb-3 opacity-30" />
            <p>Nenhum colaborador ativo encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Colaborador
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Salário Base
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Valor Lançado
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Vencimento
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salaryEntries.map((entry) => (
                  <tr
                    key={entry.employee_id}
                    className={`hover:bg-gray-50 transition-colors ${
                      entry.status === 'skipped' ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{entry.employee_name}</div>
                      {entry.notes && (
                        <div className="text-xs text-gray-400 mt-0.5">{entry.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-500">
                      R$ {entry.base_salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold">
                      {entry.status === 'pending' ? (
                        <span className="text-gray-400 italic">—</span>
                      ) : entry.status === 'skipped' ? (
                        <span className="text-gray-400 italic">Pulado</span>
                      ) : (
                        <span className="text-emerald-700">
                          R$ {entry.adjusted_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-700">
                      {new Date(`${entry.due_date}T12:00:00`).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {entry.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <AlertCircle className="w-3 h-3" />
                          Pendente
                        </span>
                      )}
                      {entry.status === 'confirmed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" />
                          Lançado
                        </span>
                      )}
                      {entry.status === 'skipped' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <SkipForward className="w-3 h-3" />
                          Pulado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {savingEntry === entry.employee_id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                        ) : (
                          <>
                            {entry.status !== 'skipped' && (
                              <button
                                onClick={() => {
                                  setEditingEntry(entry);
                                  setEditAmount(entry.adjusted_amount.toFixed(2));
                                  setEditNotes(entry.notes || '');
                                }}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                  entry.status === 'confirmed'
                                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              >
                                {entry.status === 'confirmed' ? (
                                  <><Edit2 className="w-3 h-3" /> Editar</>
                                ) : (
                                  <><Check className="w-3 h-3" /> Lançar</>
                                )}
                              </button>
                            )}
                            {entry.status === 'pending' && (
                              <button
                                onClick={() => handleSkipSalary(entry)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                                title="Pular este mês"
                              >
                                <SkipForward className="w-3 h-3" />
                              </button>
                            )}
                            {(entry.status === 'confirmed' || entry.status === 'skipped') && entry.cash_flow_id && (
                              <button
                                onClick={() => handleDeleteSalaryEntry(entry)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                title="Remover lançamento"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Lançamento/Edição de Salário */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {editingEntry.status === 'confirmed' ? 'Editar Salário' : 'Lançar Salário'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{editingEntry.employee_name}</p>
              </div>
              <button
                onClick={() => setEditingEntry(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Salário Base:</span>
                  <span className="font-semibold text-gray-900">
                    R$ {editingEntry.base_salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-gray-600">Vencimento:</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(`${editingEntry.due_date}T12:00:00`).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-gray-600">Descrição:</span>
                  <span className="text-gray-700 text-xs text-right max-w-[55%]">{editingEntry.description}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Valor a Lançar (R$)
                  {parseFloat(editAmount) !== editingEntry.base_salary && parseFloat(editAmount) > 0 && (
                    <span className="ml-2 text-xs text-amber-600 font-normal">
                      (ajustado — base: R$ {editingEntry.base_salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  autoFocus
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg font-semibold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Observações (opcional)
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex: Acréscimo por hora extra, desconto de falta..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleConfirmSalary(editingEntry, parseFloat(editAmount), editNotes)}
                  disabled={!editAmount || parseFloat(editAmount) <= 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {editingEntry.status === 'confirmed' ? 'Salvar Alteração' : 'Confirmar Lançamento'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Horas Extras - {selectedMonth}</h3>
          <button
            onClick={() => setShowOvertimeForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Clock className="w-5 h-5" />
            Registrar Hora Extra
          </button>
        </div>

        {showOvertimeForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Registrar Hora Extra</h3>
              <form onSubmit={handleSubmitOvertime} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colaborador
                  </label>
                  <select
                    required
                    value={overtimeData.employee_id}
                    onChange={(e) => setOvertimeData({ ...overtimeData, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Selecione um colaborador</option>
                    {employees.filter(emp => emp.active).map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horas
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={overtimeData.hours}
                    onChange={(e) => setOvertimeData({ ...overtimeData, hours: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Multiplicador
                  </label>
                  <select
                    required
                    value={overtimeData.rate_multiplier}
                    onChange={(e) => setOvertimeData({ ...overtimeData, rate_multiplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="1.5">1.5x (50%)</option>
                    <option value="2.0">2.0x (100%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={overtimeData.date}
                    onChange={(e) => setOvertimeData({ ...overtimeData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Registrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOvertimeForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Colaborador
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Horas
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Multiplicador
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {overtimeRecords.map((record) => {
                const employee = employees.find(emp => emp.id === record.employee_id);
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(record.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {employee?.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      {record.hours}h
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      {record.rate_multiplier}x
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteOvertime(record.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Pagamentos Extras - {selectedMonth}</h3>
          <button
            onClick={() => setShowExtraPaymentForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Plus className="w-5 h-5" />
            Registrar 13º ou Férias
          </button>
        </div>

        {showExtraPaymentForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Registrar Pagamento Extra</h3>
              <form onSubmit={handleSubmitExtraPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Colaborador
                  </label>
                  <select
                    required
                    value={extraPaymentData.employee_id}
                    onChange={(e) => setExtraPaymentData({ ...extraPaymentData, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Selecione um colaborador</option>
                    {employees.filter(emp => emp.active).map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Pagamento
                  </label>
                  <select
                    required
                    value={extraPaymentData.payment_type}
                    onChange={(e) => setExtraPaymentData({ ...extraPaymentData, payment_type: e.target.value as '13th_full' | '13th_half' | 'vacation' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="13th_full">13º Salário Integral</option>
                    <option value="13th_half">13º Salário - 1ª Parcela (50%)</option>
                    <option value="vacation">Férias</option>
                  </select>
                </div>
                {extraPaymentData.payment_type === 'vacation' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dias de Férias
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="30"
                      required
                      value={extraPaymentData.vacation_days}
                      onChange={(e) => setExtraPaymentData({ ...extraPaymentData, vacation_days: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Ex: 30"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      O valor será calculado proporcionalmente aos dias informados, incluindo 1/3 constitucional
                    </p>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Registrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExtraPaymentForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Colaborador
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Dias (Férias)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Valor
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {monthlyExtraPayments.map((payment) => {
                const employee = employees.find(emp => emp.id === payment.employee_id);
                const paymentTypeLabels = {
                  '13th_full': '13º Integral',
                  '13th_half': '13º - 1ª Parcela',
                  'vacation': 'Férias'
                };
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {employee?.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {paymentTypeLabels[payment.payment_type]}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900">
                      {payment.payment_type === 'vacation' ? `${payment.vacation_days} dias` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold text-orange-600">
                      R$ {payment.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteExtraPayment(payment.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
