import React from 'react';
import { X, Save, Plus, Home, MapPin } from 'lucide-react';

interface FormModalProps {
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  editingId: string | null;
  formData: any;
  setFormData: (data: any) => void;
  customers: Array<{ id: string; name: string; cpf: string }>;
  properties: Array<{ id: string; name: string; property_type: string; municipality: string; state: string }>;
  serviceTemplates: Array<{ id: string; name: string; unit_price: number; estimated_time_days: number }>;
  selectedServices: string[];
  setSelectedServices: (services: string[]) => void;
  handleSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export function FormModal({
  showForm,
  setShowForm,
  editingId,
  formData,
  setFormData,
  customers,
  properties,
  serviceTemplates,
  selectedServices,
  setSelectedServices,
  handleSubmit,
  loading
}: FormModalProps) {
  if (!showForm) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingId ? 'Editar Projeto' : 'Novo Projeto'}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Projeto *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
              <select
                required
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione um cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.cpf}
                  </option>
                ))}
              </select>
            </div>

            {formData.customer_id && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Imóvel *</label>
                  <select
                    required
                    value={formData.property_id}
                    onChange={(e) => {
                      const property = properties.find((p) => p.id === e.target.value);
                      setFormData({
                        ...formData,
                        property_id: e.target.value,
                        property_type: property?.property_type || 'urbano',
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione um imóvel</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name} - {property.property_type === 'rural' ? 'Rural' : 'Urbano'} - {property.municipality}/{property.state}
                      </option>
                    ))}
                  </select>
                  {properties.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">Nenhum imóvel cadastrado para este cliente</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Imóvel *</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="urbano"
                        checked={formData.property_type === 'urbano'}
                        onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                        className="mr-2"
                      />
                      <Home className="w-4 h-4 mr-1" />
                      Urbano
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="rural"
                        checked={formData.property_type === 'rural'}
                        onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
                        className="mr-2"
                      />
                      <MapPin className="w-4 h-4 mr-1" />
                      Rural
                    </label>
                  </div>
                </div>
              </>
            )}

            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Serviços do Projeto</label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {serviceTemplates.map((service) => (
                    <label key={service.id} className="flex items-start gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedServices([...selectedServices, service.id]);
                          } else {
                            setSelectedServices(selectedServices.filter((id) => id !== service.id));
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{service.name}</div>
                        <div className="text-sm text-gray-600">
                          R$ {(service.unit_price || 0).toFixed(2)} - {service.estimated_time_days || 0} dias
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início *</label>
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Previsão de Conclusão</label>
                <input
                  type="date"
                  value={formData.estimated_completion_date}
                  onChange={(e) => setFormData({ ...formData, estimated_completion_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={formData.has_deadline}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      has_deadline: e.target.checked,
                      deadline_date: e.target.checked ? formData.deadline_date : '',
                    })
                  }
                />
                <span className="text-sm font-medium text-gray-700">Este projeto possui vencimento</span>
              </label>

              {formData.has_deadline && (
                <input
                  type="date"
                  required
                  value={formData.deadline_date}
                  onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
