import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, MapPin, Building, Home, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
}

interface CustomerPropertiesProps {
  customerId: string;
}

export default function CustomerProperties({ customerId }: CustomerPropertiesProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
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
    if (customerId) {
      loadProperties();
    }
  }, [customerId]);

  const loadProperties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Erro ao carregar imóveis:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('properties')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;

        loadProperties();
      } else {
        const { data, error } = await supabase
          .from('properties')
          .insert([{
            customer_id: customerId,
            ...formData,
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setEditingId(data.id);
          loadProperties();
        }
      }
    } catch (error) {
      console.error('Erro ao salvar imóvel:', error);
      alert('Erro ao salvar imóvel');
    }
  };

  const handleEdit = (property: Property) => {
    setFormData({
      property_type: property.property_type,
      name: property.name,
      registration_number: property.registration_number,
      municipality: property.municipality,
      state: property.state,
      ccir: property.ccir,
      itr_cib: property.itr_cib,
      car_receipt_code: property.car_receipt_code,
      municipal_registration: property.municipal_registration,
      notes: property.notes,
    });
    setEditingId(property.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este imóvel e todos os seus documentos?')) return;

    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadProperties();
    } catch (error) {
      console.error('Erro ao excluir imóvel:', error);
      alert('Erro ao excluir imóvel');
    }
  };

  const estadosBrasileiros = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  if (loading) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        Carregando imóveis...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Imóveis do Cliente
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Adicionar Imóvel
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border-2 border-[#0A7EC2] rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-800">
              {editingId ? 'Editar Imóvel' : 'Novo Imóvel'}
            </h4>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Imóvel *
              </label>
              <select
                value={formData.property_type}
                onChange={(e) => setFormData({ ...formData, property_type: e.target.value as 'rural' | 'urban' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="rural">Rural</option>
                <option value="urban">Urbano</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome/Descrição do Imóvel *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Fazenda São João, Apartamento Centro"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número da Matrícula
                </label>
                <input
                  type="text"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Número da matrícula"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Município *
                </label>
                <input
                  type="text"
                  value={formData.municipality}
                  onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome do município"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {estadosBrasileiros.map(estado => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </div>
            </div>

            {formData.property_type === 'rural' && (
              <div className="border-t pt-4">
                <h5 className="text-md font-semibold text-gray-700 mb-3">Informações Rurais</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CCIR
                    </label>
                    <input
                      type="text"
                      value={formData.ccir}
                      onChange={(e) => setFormData({ ...formData, ccir: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Certificado de Cadastro de Imóvel Rural"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ITR/CIB
                    </label>
                    <input
                      type="text"
                      value={formData.itr_cib}
                      onChange={(e) => setFormData({ ...formData, itr_cib: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="ITR ou CIB"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Código do Recibo do CAR
                    </label>
                    <input
                      type="text"
                      value={formData.car_receipt_code}
                      onChange={(e) => setFormData({ ...formData, car_receipt_code: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Cadastro Ambiental Rural"
                    />
                  </div>
                </div>
              </div>
            )}

            {formData.property_type === 'urban' && (
              <div className="border-t pt-4">
                <h5 className="text-md font-semibold text-gray-700 mb-3">Informações Urbanas</h5>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cadastro Imobiliário no Município
                  </label>
                  <input
                    type="text"
                    value={formData.municipal_registration}
                    onChange={(e) => setFormData({ ...formData, municipal_registration: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Número do cadastro imobiliário"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Observações adicionais sobre o imóvel"
              />
            </div>

            {!editingId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Após salvar as informações básicas do imóvel, você poderá anexar todos os documentos (matrícula, CCIR, ITR, CAR, mapas, etc.).
                </p>
              </div>
            )}

            {editingId && (
              <div className="border-t pt-4">
                <h5 className="text-md font-semibold text-gray-700 mb-3">Documentos do Imóvel</h5>
                <p className="text-sm text-gray-600 mb-4">
                  Anexe os documentos do imóvel. Apenas o Recibo do CAR extrairá automaticamente o código para preencher o campo acima. Os demais documentos serão apenas anexados. Você pode anexar PDFs ou tirar fotos dos documentos.
                </p>

                {extracting && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
                      <div>
                        <p className="text-sm font-medium text-yellow-800">
                          Processando documento...
                        </p>
                        <p className="text-xs text-yellow-700">
                          Extraindo informações do arquivo. Isso pode levar alguns segundos.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {!editingId ? (
                <>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Cadastrar Imóvel
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Fechar e Voltar à Lista
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}

      {properties.length === 0 && !showForm ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          Nenhum imóvel cadastrado para este cliente
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map((property) => (
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
                    <h4 className="text-lg font-semibold text-gray-900">{property.name}</h4>
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

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{property.municipality} - {property.state}</span>
                </div>

                {property.registration_number && (
                  <div className="text-gray-600">
                    <span className="font-medium">Matrícula:</span> {property.registration_number}
                  </div>
                )}

                {property.property_type === 'rural' && (
                  <>
                    {property.ccir && (
                      <div className="text-gray-600">
                        <span className="font-medium">CCIR:</span> {property.ccir}
                      </div>
                    )}
                    {property.car_receipt_code && (
                      <div className="text-gray-600">
                        <span className="font-medium">CAR:</span> {property.car_receipt_code}
                      </div>
                    )}
                  </>
                )}

                {property.property_type === 'urban' && property.municipal_registration && (
                  <div className="text-gray-600">
                    <span className="font-medium">Cadastro Municipal:</span> {property.municipal_registration}
                  </div>
                )}

                {property.notes && (
                  <div className="text-gray-600 text-xs mt-2 pt-2 border-t">
                    {property.notes}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-3 border-t">
                <button
                  onClick={() => handleEdit(property)}
                  className="flex-1 bg-[#0A7EC2] text-white px-3 py-2 rounded-lg hover:bg-[#0968A8] transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(property.id)}
                  className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
