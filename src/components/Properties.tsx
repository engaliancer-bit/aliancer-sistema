import { useState, useEffect, useMemo } from 'react';
import { MapPin, Home, Building, Filter, Edit2, Search, Plus, Save, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDebounce } from '../hooks/useDebounce';

interface Property {
  id: string;
  customer_id: string;
  property_type: 'rural' | 'urban';
  name: string;
  registration_number: string;
  municipality: string;
  state: string;
  ccir: string;
  itr_cib: string;
  car_receipt_code: string;
  municipal_registration: string;
  notes: string;
  created_at: string;
  customers?: {
    name: string;
    person_type: 'pf' | 'pj';
  };
}

interface Customer {
  id: string;
  name: string;
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'rural' | 'urban'>('all');
  const [filterMunicipality, setFilterMunicipality] = useState('');
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customer_id: '',
    property_type: 'rural' as 'rural' | 'urban',
    name: '',
    registration_number: '',
    municipality: '',
    state: 'TO',
    ccir: '',
    itr_cib: '',
    car_receipt_code: '',
    municipal_registration: '',
    notes: '',
  });

  useEffect(() => {
    loadProperties();
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadProperties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          customers (
            name,
            person_type
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProperties(data || []);

      const uniqueMunicipalities = Array.from(
        new Set(data?.map(p => p.municipality).filter(Boolean) || [])
      ).sort();
      setMunicipalities(uniqueMunicipalities);
    } catch (error) {
      console.error('Erro ao carregar imóveis:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      property_type: 'rural',
      name: '',
      registration_number: '',
      municipality: '',
      state: 'TO',
      ccir: '',
      itr_cib: '',
      car_receipt_code: '',
      municipal_registration: '',
      notes: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (property: Property) => {
    setFormData({
      customer_id: property.customer_id,
      property_type: property.property_type,
      name: property.name,
      registration_number: property.registration_number,
      municipality: property.municipality,
      state: property.state,
      ccir: property.ccir || '',
      itr_cib: property.itr_cib || '',
      car_receipt_code: property.car_receipt_code || '',
      municipal_registration: property.municipal_registration || '',
      notes: property.notes || '',
    });
    setEditingId(property.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id) {
      alert('Por favor, selecione um cliente');
      return;
    }

    try {
      const propertyData = {
        customer_id: formData.customer_id,
        property_type: formData.property_type,
        name: formData.name,
        registration_number: formData.registration_number,
        municipality: formData.municipality,
        state: formData.state,
        ccir: formData.ccir || null,
        itr_cib: formData.itr_cib || null,
        car_receipt_code: formData.car_receipt_code || null,
        municipal_registration: formData.municipal_registration || null,
        notes: formData.notes || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('properties')
          .update(propertyData)
          .eq('id', editingId);

        if (error) throw error;
        alert('Imóvel atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('properties')
          .insert([propertyData]);

        if (error) throw error;
        alert('Imóvel cadastrado com sucesso!');
      }

      resetForm();
      loadProperties();
    } catch (error) {
      console.error('Erro ao salvar imóvel:', error);
      alert('Erro ao salvar imóvel');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o imóvel "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Imóvel excluído com sucesso!');
      loadProperties();
    } catch (error) {
      console.error('Erro ao excluir imóvel:', error);
      alert('Erro ao excluir imóvel');
    }
  };

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      const matchesType = filterType === 'all' || property.property_type === filterType;
      const matchesMunicipality = !filterMunicipality || property.municipality === filterMunicipality;
      const matchesSearch = !debouncedSearchTerm ||
        property.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        property.municipality?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        property.customers?.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        property.registration_number?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

      return matchesType && matchesMunicipality && matchesSearch;
    });
  }, [properties, filterType, filterMunicipality, debouncedSearchTerm]);

  const stats = {
    total: properties.length,
    rural: properties.filter(p => p.property_type === 'rural').length,
    urban: properties.filter(p => p.property_type === 'urban').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#0A7EC2] to-[#0968A8] rounded-lg shadow-md p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              Gestão de Imóveis
            </h2>
            <p className="text-blue-100">
              Cadastro e gerenciamento de imóveis rurais e urbanos
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-[#0A7EC2] rounded-lg hover:bg-blue-50 transition-colors font-semibold"
          >
            <Plus className="w-5 h-5" />
            Novo Imóvel
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-6xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingId ? 'Editar Imóvel' : 'Novo Imóvel'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {!editingId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Importante:</strong> Para anexar documentos (Matrícula, CCIR, ITR, CAR, etc.), primeiro salve as informações básicas do imóvel. Após salvar, clique no botão verde "Documentos" para gerenciar todos os documentos.
                  </p>
                </div>
              )}

              {editingId && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    <strong>Dica:</strong> Para gerenciar documentos deste imóvel (Matrícula, CCIR, ITR, CAR, Mapas, etc.), clique no botão verde "Documentos" abaixo da lista de imóveis após salvar.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cliente *
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um cliente</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Imóvel *
                  </label>
                  <select
                    value={formData.property_type}
                    onChange={(e) => setFormData({ ...formData, property_type: e.target.value as 'rural' | 'urban' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="rural">Rural</option>
                    <option value="urban">Urbano</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Imóvel *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matrícula
                  </label>
                  <input
                    type="text"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Município *
                  </label>
                  <input
                    type="text"
                    value={formData.municipality}
                    onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado *
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    {BRAZILIAN_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                {formData.property_type === 'rural' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CCIR
                      </label>
                      <input
                        type="text"
                        value={formData.ccir}
                        onChange={(e) => setFormData({ ...formData, ccir: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ITR / CIB
                      </label>
                      <input
                        type="text"
                        value={formData.itr_cib}
                        onChange={(e) => setFormData({ ...formData, itr_cib: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Código do Recibo CAR
                      </label>
                      <input
                        type="text"
                        value={formData.car_receipt_code}
                        onChange={(e) => setFormData({ ...formData, car_receipt_code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}

                {formData.property_type === 'urban' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cadastro Municipal
                    </label>
                    <input
                      type="text"
                      value={formData.municipal_registration}
                      onChange={(e) => setFormData({ ...formData, municipal_registration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>


              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8]"
                >
                  <Save className="w-4 h-4" />
                  {editingId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-[#0A7EC2]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Imóveis</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <MapPin className="w-8 h-8 text-[#0A7EC2] opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Imóveis Rurais</p>
              <p className="text-2xl font-bold text-gray-900">{stats.rural}</p>
            </div>
            <Home className="w-8 h-8 text-green-600 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Imóveis Urbanos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.urban}</p>
            </div>
            <Building className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nome, cliente, matrícula..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Imóvel
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'rural' | 'urban')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos</option>
              <option value="rural">Rural</option>
              <option value="urban">Urbano</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Município
            </label>
            <select
              value={filterMunicipality}
              onChange={(e) => setFilterMunicipality(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos os municípios</option>
              {municipalities.map((municipality) => (
                <option key={municipality} value={municipality}>
                  {municipality}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(filterType !== 'all' || filterMunicipality || searchTerm) && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Exibindo {filteredProperties.length} de {properties.length} imóveis
            </span>
            <button
              onClick={() => {
                setFilterType('all');
                setFilterMunicipality('');
                setSearchTerm('');
              }}
              className="text-[#0A7EC2] hover:text-[#0968A8] font-medium"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Imóveis Cadastrados ({filteredProperties.length})
        </h3>

        {filteredProperties.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {properties.length === 0
              ? 'Nenhum imóvel cadastrado ainda. Clique em "Novo Imóvel" para começar.'
              : 'Nenhum imóvel encontrado com os filtros aplicados'
            }
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProperties.map((property) => (
              <div
                key={property.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {property.property_type === 'rural' ? (
                        <Home className="w-5 h-5 text-green-600" />
                      ) : (
                        <Building className="w-5 h-5 text-blue-600" />
                      )}
                      <h4 className="text-lg font-semibold text-gray-900 truncate">
                        {property.name}
                      </h4>
                    </div>
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                      property.property_type === 'rural'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {property.property_type === 'rural' ? 'Rural' : 'Urbano'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-start gap-2 text-gray-700">
                    <span className="font-medium min-w-[60px]">Cliente:</span>
                    <span className="flex-1">{property.customers?.name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span>{property.municipality} - {property.state}</span>
                  </div>

                  {property.registration_number && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <span className="font-medium min-w-[70px]">Matrícula:</span>
                      <span className="flex-1">{property.registration_number}</span>
                    </div>
                  )}

                  {property.property_type === 'rural' && (
                    <>
                      {property.ccir && (
                        <div className="flex items-start gap-2 text-gray-600">
                          <span className="font-medium min-w-[70px]">CCIR:</span>
                          <span className="flex-1 text-xs">{property.ccir}</span>
                        </div>
                      )}
                      {property.car_receipt_code && (
                        <div className="flex items-start gap-2 text-gray-600">
                          <span className="font-medium min-w-[70px]">CAR:</span>
                          <span className="flex-1 text-xs">{property.car_receipt_code}</span>
                        </div>
                      )}
                    </>
                  )}

                  {property.property_type === 'urban' && property.municipal_registration && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <span className="font-medium min-w-[70px]">Cadastro:</span>
                      <span className="flex-1 text-xs">{property.municipal_registration}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleEdit(property)}
                      className="bg-[#0A7EC2] text-white px-3 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(property.id, property.name)}
                      className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
