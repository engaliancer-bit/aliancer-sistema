import { memo } from 'react';

interface Customer {
  id: string;
  name: string;
  cpf: string;
}

interface Property {
  id: string;
  name: string;
  property_type: 'rural' | 'urbano';
  municipality: string;
  state: string;
}

interface Employee {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  customer_id: string;
  property_id: string;
  property_type: 'rural' | 'urbano';
  start_date: string;
  estimated_completion_date: string;
  has_deadline: boolean;
  deadline_date: string;
  notes: string;
  is_recurring?: boolean;
  recurring_due_day?: number;
}

interface ProjectFormFieldsProps {
  formData: FormData;
  customers: Customer[];
  properties: Property[];
  employees: Employee[];
  loadingProperties: boolean;
  onFormDataChange: (data: Partial<FormData>) => void;
  onCustomerChange: (customerId: string) => void;
  isConsultoria?: boolean;
}

/**
 * Componente memoizado para os campos do formulário de projeto
 *
 * Evita re-renders desnecessários quando outros estados do componente pai mudam
 */
export const ProjectFormFields = memo(function ProjectFormFields({
  formData,
  customers,
  properties,
  employees,
  loadingProperties,
  onFormDataChange,
  onCustomerChange,
  isConsultoria = false,
}: ProjectFormFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Projeto *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => onFormDataChange({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
        <select
          required
          value={formData.customer_id}
          onChange={(e) => onCustomerChange(e.target.value)}
          disabled={loadingProperties}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Imóvel {!isConsultoria && '*'}
              {isConsultoria && (
                <span className="text-xs text-gray-500 ml-2">(opcional para consultoria)</span>
              )}
            </label>

            {loadingProperties ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                <span className="text-gray-600">Carregando imóveis...</span>
              </div>
            ) : (
              <select
                required={!isConsultoria}
                value={formData.property_id}
                onChange={(e) => {
                  const property = properties.find((p) => p.id === e.target.value);
                  onFormDataChange({
                    property_id: e.target.value,
                    property_type: property?.property_type || 'urbano',
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{isConsultoria ? 'Não vinculado a imóvel' : 'Selecione um imóvel'}</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name} - {property.property_type === 'rural' ? 'Rural' : 'Urbano'} -{' '}
                    {property.municipality}/{property.state}
                  </option>
                ))}
              </select>
            )}

            {!loadingProperties && properties.length === 0 && !isConsultoria && (
              <p className="text-sm text-gray-500 mt-1">Nenhum imóvel cadastrado para este cliente</p>
            )}

            {isConsultoria && (
              <p className="text-sm text-blue-600 mt-1">
                Para projetos de consultoria, o imóvel é opcional
              </p>
            )}
          </div>

          {(formData.property_id || isConsultoria) && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsável pelo Projeto
                </label>
                <select
                  value={formData.notes}
                  onChange={(e) => onFormDataChange({ notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Nenhum responsável</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Início *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => onFormDataChange({ start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Previsão de Conclusão
                  </label>
                  <input
                    type="date"
                    value={formData.estimated_completion_date}
                    onChange={(e) => onFormDataChange({ estimated_completion_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.has_deadline}
                    onChange={(e) =>
                      onFormDataChange({
                        has_deadline: e.target.checked,
                        deadline_date: e.target.checked ? formData.deadline_date : '',
                      })
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Este projeto possui prazo de entrega definido
                  </span>
                </label>
              </div>

              {formData.has_deadline && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prazo de Entrega *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.deadline_date}
                    onChange={(e) => onFormDataChange({ deadline_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Campos específicos para Consultoria */}
              {isConsultoria && (
                <>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_recurring || false}
                        onChange={(e) =>
                          onFormDataChange({
                            is_recurring: e.target.checked,
                            recurring_due_day: e.target.checked ? (formData.recurring_due_day || 10) : undefined,
                          })
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Cobrança Mensal Recorrente
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      O sistema calculará automaticamente o valor mensal com base no período informado
                    </p>
                  </div>

                  {formData.is_recurring && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dia do Vencimento Mensal
                      </label>
                      <select
                        value={formData.recurring_due_day || 10}
                        onChange={(e) => onFormDataChange({ recurring_due_day: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            Dia {day} de cada mês
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        As cobranças serão geradas automaticamente todo dia {formData.recurring_due_day || 10} do mês
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
});
