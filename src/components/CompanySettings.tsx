import { useState, useEffect } from 'react';
import { Save, Settings, Phone, Building2, CreditCard, MessageSquare, MapPin, FileText, User, Globe, Briefcase, Upload, Image as ImageIcon, Plus, Trash2, Edit2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Setting {
  setting_key: string;
  setting_value: string;
  description: string;
}

interface TechnicalResponsible {
  id: string;
  name: string;
  registration: string;
  council: string;
  specialty: string;
  is_default: boolean;
}

export default function CompanySettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [technicalResponsibles, setTechnicalResponsibles] = useState<TechnicalResponsible[]>([]);
  const [editingResponsible, setEditingResponsible] = useState<TechnicalResponsible | null>(null);
  const [showResponsibleForm, setShowResponsibleForm] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings.company_logo_url) {
      setLogoPreview(settings.company_logo_url);
    }
  }, [settings.company_logo_url]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      let responsibles: TechnicalResponsible[] = [];

      data?.forEach((s: Setting) => {
        settingsMap[s.setting_key] = s.setting_value;

        // Carregar responsáveis técnicos do JSONB
        if (s.setting_key === 'technical_responsibles' && s.setting_value) {
          try {
            responsibles = JSON.parse(s.setting_value);
          } catch (e) {
            console.error('Erro ao parsear responsáveis técnicos:', e);
          }
        }
      });

      // Se não há responsáveis, buscar da coluna JSONB diretamente
      if (responsibles.length === 0) {
        const { data: settingsData } = await supabase
          .from('company_settings')
          .select('technical_responsibles')
          .limit(1)
          .single();

        if (settingsData?.technical_responsibles) {
          responsibles = settingsData.technical_responsibles as TechnicalResponsible[];
        }
      }

      setSettings(settingsMap);
      setTechnicalResponsibles(responsibles);

      if (settingsMap.company_logo_url) {
        setLogoPreview(settingsMap.company_logo_url);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido');
        return;
      }

      if (file.size > 2097152) {
        alert('O arquivo deve ter no máximo 2MB');
        return;
      }

      setUploadingLogo(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `company-logo.${fileExt}`;
      const filePath = fileName;

      const { error: deleteError } = await supabase.storage
        .from('company-logo')
        .remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from('company-logo')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-logo')
        .getPublicUrl(filePath);

      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      setSettings({ ...settings, company_logo_url: logoUrl });
      setLogoPreview(logoUrl);

      const { error: upsertError } = await supabase
        .from('company_settings')
        .upsert({
          setting_key: 'company_logo_url',
          setting_value: logoUrl,
          description: 'URL pública do logotipo da empresa (exibido nos relatórios)'
        }, {
          onConflict: 'setting_key'
        });

      if (upsertError) throw upsertError;

      alert('Logo enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload da logo:', error);
      alert('Erro ao fazer upload da logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveTechnicalResponsibles = async (responsibles: TechnicalResponsible[]) => {
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({ technical_responsibles: responsibles })
        .eq('id', (await supabase.from('company_settings').select('id').limit(1).single()).data?.id);

      if (error) throw error;
      setTechnicalResponsibles(responsibles);
    } catch (error) {
      console.error('Erro ao salvar responsáveis técnicos:', error);
      throw error;
    }
  };

  const handleAddResponsible = async (responsible: Omit<TechnicalResponsible, 'id'>) => {
    try {
      const newResponsible: TechnicalResponsible = {
        ...responsible,
        id: crypto.randomUUID(),
      };

      // Se é o primeiro ou marcado como padrão, desmarcar outros
      let updatedList = [...technicalResponsibles];
      if (newResponsible.is_default || updatedList.length === 0) {
        updatedList = updatedList.map(r => ({ ...r, is_default: false }));
        newResponsible.is_default = true;
      }

      updatedList.push(newResponsible);
      await saveTechnicalResponsibles(updatedList);
      setShowResponsibleForm(false);
      setEditingResponsible(null);
      alert('Responsável técnico adicionado com sucesso!');
    } catch (error) {
      alert('Erro ao adicionar responsável técnico');
    }
  };

  const handleUpdateResponsible = async (responsible: TechnicalResponsible) => {
    try {
      let updatedList = technicalResponsibles.map(r =>
        r.id === responsible.id ? responsible : r
      );

      // Se marcou como padrão, desmarcar outros
      if (responsible.is_default) {
        updatedList = updatedList.map(r =>
          r.id === responsible.id ? r : { ...r, is_default: false }
        );
      }

      await saveTechnicalResponsibles(updatedList);
      setShowResponsibleForm(false);
      setEditingResponsible(null);
      alert('Responsável técnico atualizado com sucesso!');
    } catch (error) {
      alert('Erro ao atualizar responsável técnico');
    }
  };

  const handleDeleteResponsible = async (id: string) => {
    if (!confirm('Deseja realmente remover este responsável técnico?')) return;

    try {
      const updatedList = technicalResponsibles.filter(r => r.id !== id);

      // Se removeu o padrão e ainda tem outros, marcar o primeiro como padrão
      const hadDefault = technicalResponsibles.find(r => r.id === id)?.is_default;
      if (hadDefault && updatedList.length > 0) {
        updatedList[0].is_default = true;
      }

      await saveTechnicalResponsibles(updatedList);
      alert('Responsável técnico removido com sucesso!');
    } catch (error) {
      alert('Erro ao remover responsável técnico');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const updatedList = technicalResponsibles.map(r => ({
        ...r,
        is_default: r.id === id,
      }));

      await saveTechnicalResponsibles(updatedList);
      alert('Responsável técnico padrão definido com sucesso!');
    } catch (error) {
      alert('Erro ao definir responsável técnico padrão');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updates = Object.entries(settings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('company_settings')
          .update({ setting_value: update.setting_value })
          .eq('setting_key', update.setting_key);

        if (error) throw error;
      }

      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Carregando configurações...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-[#0A7EC2]" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configurações da Empresa</h2>
          <p className="text-gray-600">Configure os dados completos da empresa e integrações</p>
        </div>
      </div>

      <div className="bg-red-50 border-2 border-red-400 rounded-lg p-5">
        <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Configure estas informações ANTES de usar o sistema de prazos!
        </h3>
        <p className="text-sm text-red-800 mb-2">
          <strong>Obrigatório:</strong> Para que o sistema de notificações WhatsApp funcione, você precisa:
        </p>
        <ol className="list-decimal list-inside text-sm text-red-800 space-y-1 ml-2">
          <li>Preencher o <strong>Nome da Empresa</strong></li>
          <li>Preencher o <strong>Telefone do Escritório</strong></li>
          <li>Preencher o <strong>Número de WhatsApp da Empresa (REMETENTE)</strong></li>
          <li>Preencher os <strong>Dados Bancários</strong></li>
          <li>Configurar a <strong>API do WhatsApp Business</strong> (ou enviar manualmente)</li>
        </ol>
        <p className="text-sm text-red-800 mt-2">
          Sem essas configurações, as mensagens não poderão ser enviadas!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-[#0A7EC2]" />
            <h3 className="text-lg font-semibold text-gray-900">Identificação da Empresa</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razão Social
              </label>
              <input
                type="text"
                value={settings.company_legal_name || ''}
                onChange={(e) => setSettings({ ...settings, company_legal_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Aliancer Engenharia LTDA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome Fantasia
              </label>
              <input
                type="text"
                value={settings.company_trade_name || settings.company_name || ''}
                onChange={(e) => setSettings({ ...settings, company_trade_name: e.target.value, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Aliancer Engenharia"
              />
              <p className="text-xs text-gray-500 mt-1">
                Nome que aparecerá nas mensagens enviadas
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CNPJ
              </label>
              <input
                type="text"
                value={settings.company_cnpj || ''}
                onChange={(e) => setSettings({ ...settings, company_cnpj: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inscrição Estadual
                </label>
                <input
                  type="text"
                  value={settings.company_state_registration || ''}
                  onChange={(e) => setSettings({ ...settings, company_state_registration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123.456.789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inscrição Municipal
                </label>
                <input
                  type="text"
                  value={settings.company_municipal_registration || ''}
                  onChange={(e) => setSettings({ ...settings, company_municipal_registration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="12345678"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Atividade Principal
              </label>
              <input
                type="text"
                value={settings.company_main_activity || ''}
                onChange={(e) => setSettings({ ...settings, company_main_activity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Engenharia, Topografia e Construção"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-[#0A7EC2]" />
            <h3 className="text-lg font-semibold text-gray-900">Contato</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Telefone do Escritório
              </label>
              <input
                type="text"
                value={settings.company_phone || ''}
                onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(63) 99999-9999"
              />
              <p className="text-xs text-gray-500 mt-1">
                Para contato nas mensagens
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Globe className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={settings.company_email || ''}
                onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="contato@aliancer.com.br"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Globe className="w-4 h-4 inline mr-1" />
                Website
              </label>
              <input
                type="url"
                value={settings.company_website || ''}
                onChange={(e) => setSettings({ ...settings, company_website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://www.aliancer.com.br"
              />
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-900 mb-1">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                Número de WhatsApp da Empresa (REMETENTE)
              </label>
              <input
                type="text"
                value={settings.whatsapp_sender_number || ''}
                onChange={(e) => setSettings({ ...settings, whatsapp_sender_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="556399999999"
              />
              <p className="text-xs text-yellow-800 mt-1 font-medium">
                <strong>IMPORTANTE:</strong> Número no formato internacional (código do país + DDD + número).
                Ex: 556399999999 para (63) 99999-9999
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Este número deve estar vinculado à API do WhatsApp Business e será usado como origem das mensagens
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-[#0A7EC2]" />
            <h3 className="text-lg font-semibold text-gray-900">Endereço</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rua/Avenida
                </label>
                <input
                  type="text"
                  value={settings.company_address_street || ''}
                  onChange={(e) => setSettings({ ...settings, company_address_street: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Avenida Principal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número
                </label>
                <input
                  type="text"
                  value={settings.company_address_number || ''}
                  onChange={(e) => setSettings({ ...settings, company_address_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Complemento
              </label>
              <input
                type="text"
                value={settings.company_address_complement || ''}
                onChange={(e) => setSettings({ ...settings, company_address_complement: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Sala 101"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={settings.company_address_neighborhood || ''}
                onChange={(e) => setSettings({ ...settings, company_address_neighborhood: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Centro"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={settings.company_address_city || ''}
                  onChange={(e) => setSettings({ ...settings, company_address_city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Palmas"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <input
                  type="text"
                  value={settings.company_address_state || ''}
                  onChange={(e) => setSettings({ ...settings, company_address_state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="TO"
                  maxLength={2}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CEP
              </label>
              <input
                type="text"
                value={settings.company_address_zipcode || ''}
                onChange={(e) => setSettings({ ...settings, company_address_zipcode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="77000-000"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-[#0A7EC2]" />
            <h3 className="text-lg font-semibold text-gray-900">Responsável Legal</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                value={settings.company_legal_representative || ''}
                onChange={(e) => setSettings({ ...settings, company_legal_representative: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="João da Silva"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CPF
              </label>
              <input
                type="text"
                value={settings.company_legal_representative_cpf || ''}
                onChange={(e) => setSettings({ ...settings, company_legal_representative_cpf: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ImageIcon className="w-4 h-4 inline mr-1" />
                Logotipo da Empresa
              </label>

              {logoPreview && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Logo atual:</p>
                  <img
                    src={logoPreview}
                    alt="Logo da empresa"
                    className="max-h-20 max-w-full object-contain"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                    id="logo-upload"
                  />
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    {uploadingLogo ? 'Enviando...' : logoPreview ? 'Alterar Logo' : 'Enviar Logo'}
                  </div>
                </label>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Formatos aceitos: JPG, PNG, SVG. Tamanho máximo: 2MB
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Esta logo será exibida no cabeçalho de todos os relatórios
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-[#0A7EC2]" />
            <h3 className="text-lg font-semibold text-gray-900">Dados Bancários</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banco
              </label>
              <input
                type="text"
                value={settings.bank_name || ''}
                onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Banco do Brasil"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agência
                </label>
                <input
                  type="text"
                  value={settings.bank_agency || ''}
                  onChange={(e) => setSettings({ ...settings, bank_agency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conta
                </label>
                <input
                  type="text"
                  value={settings.bank_account || ''}
                  onChange={(e) => setSettings({ ...settings, bank_account: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="12345-6"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chave PIX
              </label>
              <input
                type="text"
                value={settings.bank_pix || ''}
                onChange={(e) => setSettings({ ...settings, bank_pix: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="contato@aliancer.com.br"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#0A7EC2]" />
            <h3 className="text-lg font-semibold text-gray-900">Configurações de Relatórios</h3>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-800">
              <strong>Padronização:</strong> Configure aqui o cabeçalho e rodapé padrão que será usado em todos os relatórios gerados pelo sistema.
              Isso garante consistência visual e profissionalismo em todos os documentos.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título do Cabeçalho
                </label>
                <input
                  type="text"
                  value={settings.report_header_title || ''}
                  onChange={(e) => setSettings({ ...settings, report_header_title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Título principal exibido no topo dos relatórios
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtítulo do Cabeçalho
                </label>
                <input
                  type="text"
                  value={settings.report_header_subtitle || ''}
                  onChange={(e) => setSettings({ ...settings, report_header_subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Subtítulo complementar abaixo do título
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Texto do Rodapé
              </label>
              <textarea
                value={settings.report_footer_text || ''}
                onChange={(e) => setSettings({ ...settings, report_footer_text: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Documento gerado automaticamente pelo sistema"
              />
              <p className="text-xs text-gray-500 mt-1">
                Texto exibido no rodapé de todas as páginas dos relatórios
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="report_show_logo"
                  checked={settings.report_show_logo === 'true'}
                  onChange={(e) => setSettings({ ...settings, report_show_logo: e.target.checked ? 'true' : 'false' })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="report_show_logo" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Exibir logotipo nos relatórios
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="report_show_company_info"
                  checked={settings.report_show_company_info === 'true'}
                  onChange={(e) => setSettings({ ...settings, report_show_company_info: e.target.checked ? 'true' : 'false' })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="report_show_company_info" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Exibir informações da empresa (endereço, telefone, email)
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-[#0A7EC2]" />
            <h3 className="text-lg font-semibold text-gray-900">Integração WhatsApp Business API</h3>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Importante:</strong> Para que o sistema envie notificações automáticas via WhatsApp, você precisa configurar uma API de WhatsApp Business.
              Opções populares: Twilio, Meta WhatsApp Business API, Evolution API, ou outros provedores.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL da API WhatsApp
              </label>
              <input
                type="url"
                value={settings.whatsapp_api_url || ''}
                onChange={(e) => setSettings({ ...settings, whatsapp_api_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://api.exemplo.com/whatsapp/send"
              />
              <p className="text-xs text-gray-500 mt-1">
                Endpoint para envio de mensagens
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Token de Autenticação
              </label>
              <input
                type="password"
                value={settings.whatsapp_api_token || ''}
                onChange={(e) => setSettings({ ...settings, whatsapp_api_token: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Bearer token ou API Key"
              />
              <p className="text-xs text-gray-500 mt-1">
                Token fornecido pelo provedor
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600">
              <strong>Nota:</strong> O sistema funcionará mesmo sem a API configurada, mas as mensagens não serão enviadas automaticamente.
              As mensagens geradas podem ser copiadas e enviadas manualmente.
            </p>
          </div>
        </div>

        {/* Seção: Responsáveis Técnicos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[#0A7EC2]" />
              <h3 className="text-lg font-semibold text-gray-900">Responsáveis Técnicos</h3>
            </div>
            <button
              onClick={() => {
                setEditingResponsible(null);
                setShowResponsibleForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar Responsável
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Importante:</strong> Configure os responsáveis técnicos (engenheiros, arquitetos) que podem assinar documentos técnicos como PRAD, laudos, etc.
              O responsável marcado como "Padrão" será automaticamente selecionado na geração de documentos.
            </p>
          </div>

          {technicalResponsibles.length === 0 && !showResponsibleForm ? (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>Nenhum responsável técnico cadastrado</p>
              <p className="text-sm mt-1">Clique em "Adicionar Responsável" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {technicalResponsibles.map((responsible) => (
                <div
                  key={responsible.id}
                  className={`p-4 rounded-lg border-2 ${
                    responsible.is_default
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{responsible.name}</h4>
                        {responsible.is_default && (
                          <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Padrão
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        <strong>Registro:</strong> {responsible.registration} ({responsible.council})
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Especialidade:</strong> {responsible.specialty}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {!responsible.is_default && (
                        <button
                          onClick={() => handleSetDefault(responsible.id)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                          title="Definir como padrão"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingResponsible(responsible);
                          setShowResponsibleForm(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteResponsible(responsible.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de Adicionar/Editar Responsável */}
          {showResponsibleForm && (
            <div className="mt-4 p-4 border-2 border-blue-500 rounded-lg bg-blue-50">
              <h4 className="font-semibold text-gray-900 mb-4">
                {editingResponsible ? 'Editar Responsável Técnico' : 'Novo Responsável Técnico'}
              </h4>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const responsible: TechnicalResponsible = {
                    id: editingResponsible?.id || '',
                    name: formData.get('name') as string,
                    registration: formData.get('registration') as string,
                    council: formData.get('council') as string,
                    specialty: formData.get('specialty') as string,
                    is_default: formData.get('is_default') === 'on',
                  };

                  if (editingResponsible) {
                    handleUpdateResponsible(responsible);
                  } else {
                    handleAddResponsible(responsible);
                  }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingResponsible?.name || ''}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="João Silva"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registro Profissional <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="registration"
                      defaultValue={editingResponsible?.registration || ''}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="CREA-SC 12345-0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Conselho de Classe <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="council"
                      defaultValue={editingResponsible?.council || ''}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione...</option>
                      <option value="CREA-AC">CREA-AC</option>
                      <option value="CREA-AL">CREA-AL</option>
                      <option value="CREA-AP">CREA-AP</option>
                      <option value="CREA-AM">CREA-AM</option>
                      <option value="CREA-BA">CREA-BA</option>
                      <option value="CREA-CE">CREA-CE</option>
                      <option value="CREA-DF">CREA-DF</option>
                      <option value="CREA-ES">CREA-ES</option>
                      <option value="CREA-GO">CREA-GO</option>
                      <option value="CREA-MA">CREA-MA</option>
                      <option value="CREA-MT">CREA-MT</option>
                      <option value="CREA-MS">CREA-MS</option>
                      <option value="CREA-MG">CREA-MG</option>
                      <option value="CREA-PA">CREA-PA</option>
                      <option value="CREA-PB">CREA-PB</option>
                      <option value="CREA-PR">CREA-PR</option>
                      <option value="CREA-PE">CREA-PE</option>
                      <option value="CREA-PI">CREA-PI</option>
                      <option value="CREA-RJ">CREA-RJ</option>
                      <option value="CREA-RN">CREA-RN</option>
                      <option value="CREA-RS">CREA-RS</option>
                      <option value="CREA-RO">CREA-RO</option>
                      <option value="CREA-RR">CREA-RR</option>
                      <option value="CREA-SC">CREA-SC</option>
                      <option value="CREA-SP">CREA-SP</option>
                      <option value="CREA-SE">CREA-SE</option>
                      <option value="CREA-TO">CREA-TO</option>
                      <option value="CAU-BR">CAU-BR</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Especialidade <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="specialty"
                      defaultValue={editingResponsible?.specialty || ''}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Engenharia Civil"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_default"
                    id="is_default"
                    defaultChecked={editingResponsible?.is_default || technicalResponsibles.length === 0}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_default" className="text-sm font-medium text-gray-700">
                    Definir como responsável técnico padrão
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-blue-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResponsibleForm(false);
                      setEditingResponsible(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors"
                  >
                    {editingResponsible ? 'Atualizar' : 'Adicionar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
