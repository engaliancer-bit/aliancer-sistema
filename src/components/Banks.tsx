import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Plus, Edit, Trash2, Search, DollarSign, CreditCard, Eye, EyeOff } from 'lucide-react';

interface Bank {
  id: string;
  nome: string;
  banco_codigo: string | null;
  banco_nome: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: 'corrente' | 'poupanca' | 'investimento' | 'outro';
  saldo_inicial: number;
  saldo_atual: number;
  unidade_negocio: 'fabrica' | 'escritorio' | 'construtora' | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
}

export default function Banks() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<Bank[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  const [formData, setFormData] = useState<{
    nome: string;
    banco_codigo: string;
    banco_nome: string;
    agencia: string;
    conta: string;
    tipo_conta: 'corrente' | 'poupanca' | 'investimento' | 'outro';
    saldo_inicial: string;
    unidade_negocio: 'fabrica' | 'escritorio' | 'construtora';
    observacoes: string;
    ativo: boolean;
  }>({
    nome: '',
    banco_codigo: '',
    banco_nome: '',
    agencia: '',
    conta: '',
    tipo_conta: 'corrente',
    saldo_inicial: '0',
    unidade_negocio: 'fabrica',
    observacoes: '',
    ativo: true,
  });

  useEffect(() => {
    loadBanks();
  }, []);

  useEffect(() => {
    filterBanks();
  }, [banks, searchTerm, showInactive]);

  async function loadBanks() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBanks(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar bancos:', error);
      alert('Erro ao carregar bancos: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function filterBanks() {
    let filtered = banks;

    if (!showInactive) {
      filtered = filtered.filter(b => b.ativo);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b =>
        b.nome.toLowerCase().includes(term) ||
        b.banco_nome?.toLowerCase().includes(term) ||
        b.agencia?.toLowerCase().includes(term) ||
        b.conta?.toLowerCase().includes(term)
      );
    }

    setFilteredBanks(filtered);
  }

  function openNewModal() {
    setEditingBank(null);
    setFormData({
      nome: '',
      banco_codigo: '',
      banco_nome: '',
      agencia: '',
      conta: '',
      tipo_conta: 'corrente',
      saldo_inicial: '0',
      unidade_negocio: 'fabrica',
      observacoes: '',
      ativo: true,
    });
    setShowModal(true);
  }

  function openEditModal(bank: Bank) {
    setEditingBank(bank);
    setFormData({
      nome: bank.nome,
      banco_codigo: bank.banco_codigo || '',
      banco_nome: bank.banco_nome || '',
      agencia: bank.agencia || '',
      conta: bank.conta || '',
      tipo_conta: bank.tipo_conta,
      saldo_inicial: bank.saldo_inicial.toString(),
      unidade_negocio: bank.unidade_negocio || 'fabrica',
      observacoes: bank.observacoes || '',
      ativo: bank.ativo,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const bankData = {
        nome: formData.nome,
        banco_codigo: formData.banco_codigo || null,
        banco_nome: formData.banco_nome || null,
        agencia: formData.agencia || null,
        conta: formData.conta || null,
        tipo_conta: formData.tipo_conta,
        saldo_inicial: parseFloat(formData.saldo_inicial) || 0,
        saldo_atual: editingBank ? editingBank.saldo_atual : parseFloat(formData.saldo_inicial) || 0,
        unidade_negocio: formData.unidade_negocio,
        observacoes: formData.observacoes || null,
        ativo: formData.ativo,
      };

      if (editingBank) {
        const { error } = await supabase
          .from('banks')
          .update(bankData)
          .eq('id', editingBank.id);

        if (error) throw error;
        alert('Conta bancária atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('banks')
          .insert(bankData);

        if (error) throw error;
        alert('Conta bancária cadastrada com sucesso!');
      }

      setShowModal(false);
      loadBanks();
    } catch (error: any) {
      console.error('Erro ao salvar conta bancária:', error);
      alert('Erro ao salvar conta bancária: ' + error.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir esta conta bancária?')) return;

    try {
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Conta bancária excluída com sucesso!');
      loadBanks();
    } catch (error: any) {
      console.error('Erro ao excluir conta bancária:', error);
      alert('Erro ao excluir conta bancária: ' + error.message);
    }
  }

  const totalSaldoAtual = filteredBanks
    .filter(b => b.ativo)
    .reduce((sum, b) => sum + b.saldo_atual, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-8 h-8 text-blue-600" />
            Contas Bancárias
          </h2>
          <p className="text-gray-600 mt-1">Gerencie suas contas bancárias e saldos</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Conta
        </button>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-700 font-medium">Saldo Total (Contas Ativas)</p>
            <p className="text-3xl font-bold text-green-900 mt-1">
              R$ {totalSaldoAtual.toFixed(2)}
            </p>
          </div>
          <DollarSign className="w-16 h-16 text-green-400" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nome, banco, agência ou conta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showInactive
                ? 'bg-gray-600 text-white hover:bg-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showInactive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            {showInactive ? 'Mostrar Apenas Ativas' : 'Mostrar Inativas'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Carregando contas bancárias...</p>
          </div>
        ) : filteredBanks.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma conta bancária encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Banco
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agência/Conta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Inicial
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Atual
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBanks.map((bank) => (
                  <tr key={bank.id} className={!bank.ativo ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <CreditCard className="w-5 h-5 text-blue-600 mr-2" />
                        <div>
                          <p className="font-medium text-gray-900">{bank.nome}</p>
                          {bank.observacoes && (
                            <p className="text-xs text-gray-500">{bank.observacoes}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm text-gray-900">{bank.banco_nome || '-'}</p>
                        {bank.banco_codigo && (
                          <p className="text-xs text-gray-500">Cód: {bank.banco_codigo}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {bank.agencia && bank.conta
                        ? `${bank.agencia} / ${bank.conta}`
                        : bank.agencia || bank.conta || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {bank.tipo_conta === 'corrente'
                          ? 'Corrente'
                          : bank.tipo_conta === 'poupanca'
                          ? 'Poupança'
                          : bank.tipo_conta === 'investimento'
                          ? 'Investimento'
                          : 'Outro'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      R$ {bank.saldo_inicial.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          bank.saldo_atual >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        R$ {bank.saldo_atual.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        {bank.unidade_negocio === 'fabrica'
                          ? 'Fábrica'
                          : bank.unidade_negocio === 'escritorio'
                          ? 'Escritório'
                          : bank.unidade_negocio === 'construtora'
                          ? 'Construtora'
                          : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          bank.ativo
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {bank.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(bank)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(bank.id)}
                          className="text-red-600 hover:text-red-900"
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
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingBank ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da Conta *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Conta Principal, Conta Poupança"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código do Banco
                  </label>
                  <input
                    type="text"
                    value={formData.banco_codigo}
                    onChange={(e) => setFormData({ ...formData, banco_codigo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 001, 237"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Banco
                  </label>
                  <input
                    type="text"
                    value={formData.banco_nome}
                    onChange={(e) => setFormData({ ...formData, banco_nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Banco do Brasil"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agência</label>
                  <input
                    type="text"
                    value={formData.agencia}
                    onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 1234-5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conta</label>
                  <input
                    type="text"
                    value={formData.conta}
                    onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 12345-6"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Conta *
                  </label>
                  <select
                    value={formData.tipo_conta}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tipo_conta: e.target.value as 'corrente' | 'poupanca' | 'investimento' | 'outro',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Conta Poupança</option>
                    <option value="investimento">Conta Investimento</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidade de Negócio *
                  </label>
                  <select
                    value={formData.unidade_negocio}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unidade_negocio: e.target.value as 'fabrica' | 'escritorio' | 'construtora',
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="fabrica">Fábrica</option>
                    <option value="escritorio">Escritório</option>
                    <option value="construtora">Construtora</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saldo Inicial (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.saldo_inicial}
                  onChange={(e) => setFormData({ ...formData, saldo_inicial: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingBank
                    ? 'O saldo atual não será alterado'
                    : 'O saldo inicial será usado como saldo atual'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Informações adicionais sobre esta conta..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="ativo" className="text-sm font-medium text-gray-700">
                  Conta Ativa
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingBank ? 'Atualizar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
