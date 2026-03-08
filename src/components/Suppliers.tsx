import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Building2, Save, Check, Phone, Mail, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  contact: string;
  address: string;
  notes: string;
  created_at: string;
}

interface SupplierContact {
  id: string;
  supplier_id: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  is_primary: boolean;
  is_whatsapp: boolean;
  notes: string;
  created_at: string;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    email: '',
    contact: '',
    address: '',
    notes: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showContactsDialog, setShowContactsDialog] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactFormData, setContactFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: '',
    is_primary: false,
    is_whatsapp: true,
    notes: '',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (editingId && formData.name.trim()) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      setAutoSaveStatus('idle');

      autoSaveTimerRef.current = setTimeout(async () => {
        await autoSave();
      }, 2000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, editingId]);

  const autoSave = async () => {
    if (!editingId || !formData.name.trim()) return;

    try {
      setAutoSaveStatus('saving');

      const { error } = await supabase
        .from('suppliers')
        .update(formData)
        .eq('id', editingId);

      if (error) throw error;

      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);

      loadSuppliers();
    } catch (error) {
      console.error('Erro ao salvar automaticamente:', error);
      setAutoSaveStatus('idle');
    }
  };

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      alert('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Nome do fornecedor é obrigatório');
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('suppliers')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([formData]);

        if (error) throw error;
      }

      setFormData({ name: '', cnpj: '', email: '', contact: '', address: '', notes: '' });
      setEditingId(null);
      loadSuppliers();
    } catch (error) {
      console.error('Erro ao salvar fornecedor:', error);
      alert('Erro ao salvar fornecedor');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      cnpj: supplier.cnpj || '',
      email: supplier.email || '',
      contact: supplier.contact,
      address: supplier.address,
      notes: supplier.notes,
    });
    setEditingId(supplier.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadSuppliers();
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
      alert('Erro ao excluir fornecedor');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', cnpj: '', email: '', contact: '', address: '', notes: '' });
    setEditingId(null);
  };

  const handleManageContacts = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    await loadContacts(supplier.id);
    setShowContactsDialog(true);
  };

  const loadContacts = async (supplierId: string) => {
    try {
      const { data, error } = await supabase
        .from('supplier_contacts')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('is_primary', { ascending: false })
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      alert('Erro ao carregar contatos');
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactFormData.name.trim()) {
      alert('Nome do contato é obrigatório');
      return;
    }

    if (!selectedSupplier) return;

    try {
      if (editingContactId) {
        const { error } = await supabase
          .from('supplier_contacts')
          .update(contactFormData)
          .eq('id', editingContactId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('supplier_contacts')
          .insert([{
            supplier_id: selectedSupplier.id,
            ...contactFormData,
          }]);

        if (error) throw error;
      }

      setContactFormData({
        name: '',
        phone: '',
        email: '',
        role: '',
        is_primary: false,
        is_whatsapp: true,
        notes: '',
      });
      setEditingContactId(null);
      await loadContacts(selectedSupplier.id);
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      alert('Erro ao salvar contato');
    }
  };

  const handleEditContact = (contact: SupplierContact) => {
    setContactFormData({
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      role: contact.role || '',
      is_primary: contact.is_primary,
      is_whatsapp: contact.is_whatsapp,
      notes: contact.notes || '',
    });
    setEditingContactId(contact.id);
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;

    try {
      const { error } = await supabase
        .from('supplier_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      if (selectedSupplier) {
        await loadContacts(selectedSupplier.id);
      }
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      alert('Erro ao excluir contato');
    }
  };

  const handleCancelContact = () => {
    setContactFormData({
      name: '',
      phone: '',
      email: '',
      role: '',
      is_primary: false,
      is_whatsapp: true,
      notes: '',
    });
    setEditingContactId(null);
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            {editingId ? 'Editar Fornecedor' : 'Cadastrar Novo Fornecedor'}
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
              Nome do Fornecedor *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: Cimentos ABC Ltda"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ
              </label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="email@fornecedor.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contato (Telefone)
              </label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="(00) 0000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endereço
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Endereço do fornecedor"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Observações sobre o fornecedor"
              rows={2}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
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
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Fornecedores Cadastrados ({suppliers.length})
        </h3>

        {suppliers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum fornecedor cadastrado ainda
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fornecedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CNPJ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endereço
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {supplier.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {supplier.cnpj || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {supplier.email || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {supplier.contact || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {supplier.address || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleManageContacts(supplier)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Gerenciar Contatos"
                      >
                        <Users className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="text-orange-600 hover:text-orange-900 mr-3"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showContactsDialog && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Contatos de {selectedSupplier.name}
              </h3>
              <button
                onClick={() => {
                  setShowContactsDialog(false);
                  setSelectedSupplier(null);
                  setContacts([]);
                  handleCancelContact();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  {editingContactId ? 'Editar Contato' : 'Adicionar Novo Contato'}
                </h4>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome do Contato *
                      </label>
                      <input
                        type="text"
                        value={contactFormData.name}
                        onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: João Silva"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cargo/Função
                      </label>
                      <input
                        type="text"
                        value={contactFormData.role}
                        onChange={(e) => setContactFormData({ ...contactFormData, role: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Vendedor, Gerente"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Telefone
                      </label>
                      <input
                        type="text"
                        value={contactFormData.phone}
                        onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={contactFormData.email}
                        onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contactFormData.is_whatsapp}
                        onChange={(e) => setContactFormData({ ...contactFormData, is_whatsapp: e.target.checked })}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">WhatsApp disponível</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contactFormData.is_primary}
                        onChange={(e) => setContactFormData({ ...contactFormData, is_primary: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Contato principal</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações
                    </label>
                    <textarea
                      value={contactFormData.notes}
                      onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Observações sobre este contato"
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {editingContactId ? 'Atualizar Contato' : 'Adicionar Contato'}
                    </button>
                    {editingContactId && (
                      <button
                        type="button"
                        onClick={handleCancelContact}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Contatos Cadastrados ({contacts.length})
                </h4>

                {contacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    Nenhum contato adicional cadastrado
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-gray-900">{contact.name}</h5>
                              {contact.is_primary && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                  Principal
                                </span>
                              )}
                              {contact.is_whatsapp && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                  WhatsApp
                                </span>
                              )}
                            </div>

                            {contact.role && (
                              <p className="text-sm text-gray-600 mb-2">{contact.role}</p>
                            )}

                            <div className="space-y-1">
                              {contact.phone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Phone className="w-4 h-4" />
                                  {contact.phone}
                                </div>
                              )}
                              {contact.email && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Mail className="w-4 h-4" />
                                  {contact.email}
                                </div>
                              )}
                            </div>

                            {contact.notes && (
                              <p className="text-xs text-gray-500 mt-2">{contact.notes}</p>
                            )}
                          </div>

                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleEditContact(contact)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteContact(contact.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowContactsDialog(false);
                  setSelectedSupplier(null);
                  setContacts([]);
                  handleCancelContact();
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
