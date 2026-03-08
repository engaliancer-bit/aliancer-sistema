import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Edit2, Trash2, UserPlus, Save, Check, X, MapPin, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CustomerProperties from './CustomerProperties';
import { usePagination } from '../hooks/usePagination';
import { useDebounce } from '../hooks/useDebounce';

interface Customer {
  id: string;
  name: string;
  cpf: string;
  person_type: 'pf' | 'pj';
  state_registration?: string;
  street: string;
  neighborhood: string;
  city: string;
  email: string;
  phone: string;
  spouse_name?: string;
  spouse_cpf?: string;
  marital_status_type?: 'solteiro' | 'casamento' | 'uniao_estavel';
  marital_regime?: 'comunhao_parcial' | 'comunhao_universal' | 'separacao_total' | 'participacao_final';
  created_at: string;
}

interface CustomersProps {
  showProperties?: boolean;
}

export default function Customers({ showProperties = false }: CustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customersOffset, setCustomersOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const CUSTOMERS_PAGE_SIZE = 50;
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    person_type: 'pf' as 'pf' | 'pj',
    state_registration: '',
    street: '',
    neighborhood: '',
    city: '',
    email: '',
    phone: '',
    spouse_name: '',
    spouse_cpf: '',
    marital_status_type: '' as '' | 'solteiro' | 'casamento' | 'uniao_estavel',
    marital_regime: '' as '' | 'comunhao_parcial' | 'comunhao_universal' | 'separacao_total' | 'participacao_final',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const formDataRef = useRef(formData);
  const customersRef = useRef(customers);
  const editingIdRef = useRef(editingId);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  const [selectedCustomerForProperties, setSelectedCustomerForProperties] = useState<Customer | null>(null);

  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { customersRef.current = customers; }, [customers]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);

  const loadCustomers = useCallback(async (query: string = '') => {
    try {
      setCustomersOffset(0);

      let q = supabase
        .from('customers')
        .select('*');

      if (query.trim()) {
        q = q.or(`name.ilike.%${query}%,cpf.ilike.%${query}%,email.ilike.%${query}%`);
      }

      const { data, error, count } = await q
        .order('name')
        .range(0, CUSTOMERS_PAGE_SIZE - 1);

      if (error) throw error;

      setCustomers(data || []);
      setHasMore((data?.length || 0) === CUSTOMERS_PAGE_SIZE);
      setCustomersOffset(CUSTOMERS_PAGE_SIZE);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      alert('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreCustomers = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);

      let q = supabase
        .from('customers')
        .select('*');

      if (debouncedSearchTerm?.trim()) {
        q = q.or(`name.ilike.%${debouncedSearchTerm}%,cpf.ilike.%${debouncedSearchTerm}%,email.ilike.%${debouncedSearchTerm}%`);
      }

      const { data, error } = await q
        .order('name')
        .range(customersOffset, customersOffset + CUSTOMERS_PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        setCustomers(prev => [...prev, ...data]);
        setHasMore(data.length === CUSTOMERS_PAGE_SIZE);
        setCustomersOffset(prev => prev + CUSTOMERS_PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Erro ao carregar mais clientes:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [customersOffset, hasMore, loadingMore, debouncedSearchTerm]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      loadCustomers(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, loadCustomers]);

  const autoSave = useCallback(async () => {
    const currentEditingId = editingIdRef.current;
    const currentFormData = formDataRef.current;
    const currentCustomers = customersRef.current;

    if (!currentEditingId || !currentFormData.name.trim() || !currentFormData.cpf.trim()) return;

    try {
      setAutoSaveStatus('saving');

      const dataToSave = {
        name: currentFormData.name.trim(),
        cpf: currentFormData.cpf.trim(),
        person_type: currentFormData.person_type,
        state_registration: currentFormData.state_registration?.trim() || null,
        street: currentFormData.street.trim(),
        neighborhood: currentFormData.neighborhood.trim(),
        city: currentFormData.city.trim(),
        email: currentFormData.email.trim(),
        phone: currentFormData.phone.trim(),
        spouse_name: currentFormData.spouse_name?.trim() || null,
        spouse_cpf: currentFormData.spouse_cpf?.trim() || null,
        marital_status_type: currentFormData.marital_status_type || null,
        marital_regime: (currentFormData.marital_status_type === 'solteiro' || !currentFormData.marital_status_type) ? null : (currentFormData.marital_regime || null),
      };

      const { error } = await supabase
        .from('customers')
        .update(dataToSave)
        .eq('id', currentEditingId);

      if (error) throw error;

      setAutoSaveStatus('saved');
      if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current);
      autoSaveStatusTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 2000);

      const updatedCustomer = { ...currentCustomers.find(c => c.id === currentEditingId), ...dataToSave };
      setCustomers(prev => prev.map(c => c.id === currentEditingId ? updatedCustomer as Customer : c));
    } catch (error: any) {
      console.error('Erro ao salvar automaticamente:', error);
      setAutoSaveStatus('idle');

      if (error?.code === '23505' && error?.message?.includes('customers_cpf_key')) {
        const docType = currentFormData.person_type === 'pf' ? 'CPF' : 'CNPJ';
        alert(`Este ${docType} já está cadastrado no sistema. Por favor, verifique o ${docType} informado.`);
      }
    }
  }, []);

  useEffect(() => {
    if (!editingId || !formData.name.trim() || !formData.cpf.trim()) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      return;
    }

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus('idle');

    autoSaveTimerRef.current = setTimeout(() => {
      autoSave();
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [editingId, autoSave]);

  useEffect(() => {
    return () => {
      if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Nome do cliente é obrigatório');
      return;
    }

    if (!formData.cpf.trim()) {
      alert(formData.person_type === 'pf' ? 'CPF é obrigatório' : 'CNPJ é obrigatório');
      return;
    }

    try {
      if (!editingId) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id, name')
          .eq('cpf', formData.cpf)
          .maybeSingle();

        if (existingCustomer) {
          const docType = formData.person_type === 'pf' ? 'CPF' : 'CNPJ';
          alert(`Este ${docType} já está cadastrado para o cliente: ${existingCustomer.name}`);
          return;
        }
      }

      const dataToSave = {
        name: formData.name.trim(),
        cpf: formData.cpf.trim(),
        person_type: formData.person_type,
        state_registration: formData.state_registration?.trim() || null,
        street: formData.street.trim(),
        neighborhood: formData.neighborhood.trim(),
        city: formData.city.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        spouse_name: formData.spouse_name?.trim() || null,
        spouse_cpf: formData.spouse_cpf?.trim() || null,
        marital_status_type: formData.marital_status_type || null,
        marital_regime: (formData.marital_status_type === 'solteiro' || !formData.marital_status_type) ? null : (formData.marital_regime || null),
      };

      if (editingId) {
        const { error } = await supabase
          .from('customers')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customers')
          .insert([dataToSave]);

        if (error) throw error;
      }

      setFormData({
        name: '',
        cpf: '',
        person_type: 'pf',
        state_registration: '',
        street: '',
        neighborhood: '',
        city: '',
        email: '',
        phone: '',
        spouse_name: '',
        spouse_cpf: '',
        marital_status_type: '',
        marital_regime: '',
      });
      setEditingId(null);
      loadCustomers();
      alert('Cliente salvo com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error);

      let errorMessage = 'Erro ao salvar cliente';

      if (error?.code === '23505' && error?.message?.includes('customers_cpf_key')) {
        errorMessage = formData.person_type === 'pf'
          ? `Este CPF já está cadastrado no sistema. Por favor, verifique o CPF informado.`
          : `Este CNPJ já está cadastrado no sistema. Por favor, verifique o CNPJ informado.`;
      } else if (error?.message) {
        errorMessage = `Erro ao salvar cliente: ${error.message}`;
      }

      alert(errorMessage);
    }
  };

  const handleEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
      cpf: customer.cpf,
      person_type: customer.person_type || 'pf',
      state_registration: customer.state_registration || '',
      street: customer.street || '',
      neighborhood: customer.neighborhood || '',
      city: customer.city || '',
      email: customer.email || '',
      phone: customer.phone || '',
      spouse_name: customer.spouse_name || '',
      spouse_cpf: customer.spouse_cpf || '',
      marital_status_type: customer.marital_status_type || '',
      marital_regime: customer.marital_regime || '',
    });
    setEditingId(customer.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadCustomers();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      alert('Erro ao excluir cliente');
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      cpf: '',
      person_type: 'pf',
      state_registration: '',
      street: '',
      neighborhood: '',
      city: '',
      email: '',
      phone: '',
      spouse_name: '',
      spouse_cpf: '',
      marital_status_type: '',
      marital_regime: '',
    });
    setEditingId(null);
  };

  const memoizedCustomers = useMemo(() => customers, [customers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            {editingId ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
          </h2>
          {editingId && (
            <div className="flex items-center gap-2">
              {autoSaveStatus === 'saving' && (
                <span className="text-sm text-blue-600 flex items-center gap-1">
                  <Save className="w-4 h-4 animate-pulse" />
                  Salvando...
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Salvo
                </span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Pessoa *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="person_type"
                  value="pf"
                  checked={formData.person_type === 'pf'}
                  onChange={(e) => setFormData({ ...formData, person_type: e.target.value as 'pf' | 'pj' })}
                  className="mr-2"
                />
                <span className="text-gray-700">Pessoa Física</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="person_type"
                  value="pj"
                  checked={formData.person_type === 'pj'}
                  onChange={(e) => setFormData({ ...formData, person_type: e.target.value as 'pf' | 'pj' })}
                  className="mr-2"
                />
                <span className="text-gray-700">Pessoa Jurídica</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome/Razão Social *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                placeholder={formData.person_type === 'pf' ? 'Ex: João da Silva' : 'Ex: Empresa ABC Ltda'}
                autoComplete="name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.person_type === 'pf' ? 'CPF *' : 'CNPJ *'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                placeholder={formData.person_type === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
                autoComplete="off"
                required
              />
            </div>
          </div>

          {formData.person_type === 'pj' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inscrição Estadual
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.state_registration}
                onChange={(e) => setFormData({ ...formData, state_registration: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                placeholder="Ex: 123.456.789.012"
                autoComplete="off"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rua/Endereço
            </label>
            <input
              type="text"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
              placeholder="Ex: Rua das Flores, 123"
              autoComplete="street-address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                placeholder="Ex: Centro"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                placeholder="Ex: São Paulo"
                autoComplete="address-level2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                inputMode="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                placeholder="email@exemplo.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <div className="flex gap-2">
                <div className="w-20">
                  <input
                    type="text"
                    value="+55"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 font-semibold text-center text-base"
                  />
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, phone: value });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                  placeholder="63999998888"
                  maxLength={11}
                  autoComplete="tel"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Digite apenas números: DDD + Telefone (ex: 63999998888)
              </p>
            </div>
          </div>

          {formData.person_type === 'pf' && (
            <>
              <div className="border-t pt-4 mt-2">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Informações do Cônjuge (Opcional)
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado Civil
                    </label>
                    <select
                      value={formData.marital_status_type}
                      onChange={(e) => {
                        const newValue = e.target.value as any;
                        if (newValue === 'solteiro' || newValue === '') {
                          setFormData({
                            ...formData,
                            marital_status_type: newValue,
                            marital_regime: '',
                            spouse_name: '',
                            spouse_cpf: ''
                          });
                        } else {
                          setFormData({ ...formData, marital_status_type: newValue });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                    >
                      <option value="">Selecione...</option>
                      <option value="solteiro">Solteiro(a)</option>
                      <option value="casamento">Casado(a)</option>
                      <option value="uniao_estavel">União Estável</option>
                    </select>
                  </div>

                  {(formData.marital_status_type === 'casamento' || formData.marital_status_type === 'uniao_estavel') && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome do Cônjuge
                          </label>
                          <input
                            type="text"
                            value={formData.spouse_name}
                            onChange={(e) => setFormData({ ...formData, spouse_name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                            placeholder="Ex: Maria da Silva"
                            autoComplete="off"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            CPF do Cônjuge
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formData.spouse_cpf}
                            onChange={(e) => setFormData({ ...formData, spouse_cpf: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                            placeholder="000.000.000-00"
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Regime de Bens
                        </label>
                        <select
                          value={formData.marital_regime}
                          onChange={(e) => setFormData({ ...formData, marital_regime: e.target.value as any })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-base"
                        >
                          <option value="">Selecione o regime...</option>
                          <option value="comunhao_parcial">Comunhão Parcial de Bens</option>
                          <option value="comunhao_universal">Comunhão Universal de Bens</option>
                          <option value="separacao_total">Separação Total de Bens</option>
                          <option value="participacao_final">Participação Final nos Aquestos</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Regime de comunhão de bens do casamento ou união estável
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-[#0A7EC2] text-white px-6 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Clientes Cadastrados ({memoizedCustomers.length})
          </h3>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ, telefone, email, cidade..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
            />
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-600 mt-2">
              Mostrando {memoizedCustomers.length} clientes
            </p>
          )}
          {!searchTerm && (
            <p className="text-sm text-gray-600 mt-2">
              Carregados: {memoizedCustomers.length} clientes {hasMore && '(mais disponíveis)'}
            </p>
          )}
        </div>

        {memoizedCustomers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'Nenhum cliente encontrado com os termos de busca' : 'Nenhum cliente cadastrado ainda'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome/Razão Social
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPF/CNPJ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inscrição Estadual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endereço
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cônjuge
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {memoizedCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                      {showProperties && (
                        <button
                          onClick={() => {
                            setSelectedCustomerForProperties(customer);
                            setShowPropertiesDialog(true);
                          }}
                          className="text-green-600 hover:text-green-900 mr-3"
                          title="Imóveis"
                        >
                          <MapPin className="w-4 h-4 inline" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(customer)}
                        className="text-[#0A7EC2] hover:text-[#0968A8] mr-3"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {customer.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {customer.person_type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {customer.cpf}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {customer.person_type === 'pj' && customer.state_registration ? customer.state_registration : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {customer.street && customer.neighborhood
                          ? `${customer.street}, ${customer.neighborhood}`
                          : customer.street || customer.neighborhood || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {customer.city || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {customer.email || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {customer.phone || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {customer.person_type === 'pf' && customer.spouse_name ? (
                          <div className="space-y-1">
                            <div className="font-medium">{customer.spouse_name}</div>
                            {customer.spouse_cpf && (
                              <div className="text-xs text-gray-500">CPF: {customer.spouse_cpf}</div>
                            )}
                            {customer.marital_status_type && (
                              <div className="text-xs text-gray-500">
                                {customer.marital_status_type === 'solteiro' ? 'Solteiro(a)' : customer.marital_status_type === 'casamento' ? 'Casado(a)' : 'União Estável'}
                              </div>
                            )}
                            {customer.marital_regime && (
                              <div className="text-xs text-gray-500">
                                {customer.marital_regime === 'comunhao_parcial' && 'Comunhão Parcial'}
                                {customer.marital_regime === 'comunhao_universal' && 'Comunhão Universal'}
                                {customer.marital_regime === 'separacao_total' && 'Separação Total'}
                                {customer.marital_regime === 'participacao_final' && 'Participação Final'}
                              </div>
                            )}
                          </div>
                        ) : '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {hasMore && (
              <div className="flex items-center justify-center px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={loadMoreCustomers}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Carregando...
                    </>
                  ) : (
                    <>
                      <ChevronLeft className="w-4 h-4 rotate-90" />
                      Carregar Mais Clientes
                    </>
                  )}
                </button>
              </div>
            )}

            {!hasMore && (
              <div className="flex items-center justify-center px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600">Todos os clientes foram carregados</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showPropertiesDialog && selectedCustomerForProperties && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Imóveis do Cliente: {selectedCustomerForProperties.name}
              </h3>
              <button
                onClick={() => {
                  setShowPropertiesDialog(false);
                  setSelectedCustomerForProperties(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <CustomerProperties customerId={selectedCustomerForProperties.id} />
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowPropertiesDialog(false);
                  setSelectedCustomerForProperties(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
