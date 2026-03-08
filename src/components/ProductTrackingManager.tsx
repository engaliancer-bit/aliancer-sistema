import { useState, useEffect } from 'react';
import { QrCode, Edit2, Save, X, Download, ExternalLink, Search, Calendar, Package } from 'lucide-react';
import { supabase, ProductTracking } from '../lib/supabase';
import QRCode from 'qrcode';

export default function ProductTrackingManager() {
  const [trackings, setTrackings] = useState<ProductTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editForm, setEditForm] = useState({
    expedition_date: '',
    assembly_date: '',
    additional_notes: ''
  });

  useEffect(() => {
    loadTrackings();
  }, []);

  const loadTrackings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_tracking')
        .select(`
          *,
          products (
            name,
            unit
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrackings(data || []);
    } catch (err) {
      console.error('Erro ao carregar rastreamentos:', err);
      alert('Erro ao carregar rastreamentos');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (tracking: ProductTracking) => {
    setEditingId(tracking.id);
    setEditForm({
      expedition_date: tracking.expedition_date || '',
      assembly_date: tracking.assembly_date || '',
      additional_notes: tracking.additional_notes || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      expedition_date: '',
      assembly_date: '',
      additional_notes: ''
    });
  };

  const saveEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from('product_tracking')
        .update({
          expedition_date: editForm.expedition_date || null,
          assembly_date: editForm.assembly_date || null,
          additional_notes: editForm.additional_notes || null
        })
        .eq('id', id);

      if (error) throw error;

      alert('Informações atualizadas com sucesso!');
      setEditingId(null);
      loadTrackings();
    } catch (err) {
      console.error('Erro ao atualizar:', err);
      alert('Erro ao atualizar informações');
    }
  };

  const generateQRCode = async (token: string) => {
    try {
      const url = `${window.location.origin}/track/${token}`;

      // Gera o QR code como data URL
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      // Converte data URL para blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Faz o download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `qrcode_${token.slice(0, 8)}.png`;
      link.click();

      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Erro ao gerar QR code:', err);
      alert('Erro ao gerar QR code');
    }
  };

  const openPublicView = (token: string) => {
    const url = `${window.location.origin}/track/${token}`;
    window.open(url, '_blank');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const filteredTrackings = trackings.filter(tracking => {
    const searchLower = searchTerm.toLowerCase();
    return (
      tracking.products?.name.toLowerCase().includes(searchLower) ||
      tracking.recipe_name.toLowerCase().includes(searchLower) ||
      tracking.qr_token.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 rounded-lg">
            <QrCode className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Gerenciar QR Codes</h2>
            <p className="text-gray-600">Atualize as informações de rastreamento dos produtos</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por produto, traço ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredTrackings.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum produto com QR code encontrado</p>
              <p className="text-gray-500 text-sm mt-2">
                Gere QR codes ao informar produção ou criar ordens de produção
              </p>
            </div>
          ) : (
            filteredTrackings.map((tracking) => (
              <div key={tracking.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                {editingId === tracking.id ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {tracking.products?.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Traço: {tracking.recipe_name} | Qtd: {tracking.quantity} {tracking.products?.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveEdit(tracking.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          Salvar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data de Produção (somente leitura)
                        </label>
                        <input
                          type="date"
                          value={tracking.production_date}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data de Expedição
                        </label>
                        <input
                          type="date"
                          value={editForm.expedition_date}
                          onChange={(e) => setEditForm({ ...editForm, expedition_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data de Montagem
                        </label>
                        <input
                          type="date"
                          value={editForm.assembly_date}
                          onChange={(e) => setEditForm({ ...editForm, assembly_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Observações Adicionais
                      </label>
                      <textarea
                        value={editForm.additional_notes}
                        onChange={(e) => setEditForm({ ...editForm, additional_notes: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Digite observações sobre este produto..."
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800 mb-1">
                          {tracking.products?.name}
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                          <span>Traço: {tracking.recipe_name}</span>
                          <span>Qtd: {tracking.quantity} {tracking.products?.unit}</span>
                          <span>Produzido em: {formatDate(tracking.production_date)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(tracking)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar informações"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => generateQRCode(tracking.qr_token)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Baixar QR Code"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openPublicView(tracking.qr_token)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Ver página pública"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-600 mb-1">Data de Expedição</p>
                        <p className="font-medium text-gray-800">
                          {tracking.expedition_date ? formatDate(tracking.expedition_date) : 'Não informado'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-600 mb-1">Data de Montagem</p>
                        <p className="font-medium text-gray-800">
                          {tracking.assembly_date ? formatDate(tracking.assembly_date) : 'Não informado'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-600 mb-1">Código</p>
                        <p className="font-mono text-xs text-gray-600 truncate">
                          {tracking.qr_token.slice(0, 16)}...
                        </p>
                      </div>
                    </div>

                    {tracking.additional_notes && (
                      <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{tracking.additional_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
