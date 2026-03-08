import { useState, useEffect } from 'react';
import { Share2, Copy, Check, QrCode, Link as LinkIcon, Download, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';

interface Module {
  id: string;
  name: string;
  category: 'factory' | 'engineering' | 'construction';
  icon: string;
  description: string;
}

const AVAILABLE_MODULES: Module[] = [
  { id: 'products', name: 'Produtos', category: 'factory', icon: '📦', description: 'Cadastro e gestão de produtos' },
  { id: 'molds', name: 'Moldes', category: 'factory', icon: '🔲', description: 'Cadastro de formas e moldes' },
  { id: 'materials', name: 'Insumos/Compras', category: 'factory', icon: '💧', description: 'Gestão de materiais e compras' },
  { id: 'recipes', name: 'Traços', category: 'factory', icon: '⚗️', description: 'Cadastro de traços de concreto' },
  { id: 'production', name: 'Produção', category: 'factory', icon: '📋', description: 'Acompanhamento da produção diária' },
  { id: 'production-orders', name: 'Ordens de Produção', category: 'factory', icon: '📝', description: 'Gerenciamento de ordens de produção' },
  { id: 'production-pending', name: 'Itens a Produzir', category: 'factory', icon: '⏳', description: 'Lista de itens pendentes de produção' },
  { id: 'stage-tracker', name: 'Etapas de Produção', category: 'factory', icon: '📊', description: 'Rastreamento de estágios de produção' },
  { id: 'deliveries', name: 'Entregas', category: 'factory', icon: '🚚', description: 'Gestão de entregas' },
  { id: 'customers', name: 'Clientes', category: 'factory', icon: '👤', description: 'Cadastro de clientes' },
  { id: 'compositions', name: 'Composições', category: 'factory', icon: '🔧', description: 'Composições de produtos' },
  { id: 'quotes', name: 'Orçamentos', category: 'factory', icon: '📄', description: 'Criação de orçamentos' },
  { id: 'ribbed-slab-quote', name: 'Orçamento de Laje Treliçada', category: 'factory', icon: '🏗️', description: 'Orçamentos de lajes treliçadas' },
  { id: 'inventory', name: 'Estoque Produtos', category: 'factory', icon: '📦', description: 'Controle de estoque de produtos' },
  { id: 'material-inventory', name: 'Estoque Insumos', category: 'factory', icon: '💧', description: 'Controle de estoque de insumos' },
  { id: 'stock-alerts', name: 'Alerta de Estoque', category: 'factory', icon: '⚠️', description: 'Alertas de estoque baixo' },
  { id: 'suppliers', name: 'Fornecedores', category: 'factory', icon: '🏢', description: 'Cadastro de fornecedores' },
  { id: 'tracking', name: 'QR Codes', category: 'factory', icon: '📱', description: 'Rastreamento por QR Code' },
  { id: 'employees', name: 'Colaboradores', category: 'factory', icon: '👥', description: 'Gestão de colaboradores' },
  { id: 'production-costs', name: 'Custos de Produção', category: 'factory', icon: '📊', description: 'Análise de custos' },
  { id: 'indirect-costs', name: 'Financeiro', category: 'factory', icon: '💰', description: 'Gestão financeira e custos indiretos' },
  { id: 'cashflow', name: 'Receitas/Despesas', category: 'factory', icon: '💵', description: 'Fluxo de caixa detalhado' },
  { id: 'sales-prices', name: 'Tabela de Preços', category: 'factory', icon: '🏷️', description: 'Tabela de preços de venda' },
  { id: 'dashboard', name: 'Metas', category: 'factory', icon: '🎯', description: 'Metas e indicadores' },
  { id: 'sales-report', name: 'Relatório de Produção', category: 'factory', icon: '📊', description: 'Relatórios gerenciais' },
  { id: 'customer-statement', name: 'Extrato do Cliente', category: 'factory', icon: '📄', description: 'Extrato financeiro e histórico do cliente' },

  { id: 'eng-customers', name: 'Clientes', category: 'engineering', icon: '👤', description: 'Clientes de engenharia' },
  { id: 'eng-properties', name: 'Imóveis', category: 'engineering', icon: '🏠', description: 'Gestão de propriedades' },
  { id: 'eng-projects', name: 'Projetos', category: 'engineering', icon: '📐', description: 'Projetos de engenharia' },
  { id: 'eng-finance', name: 'Receitas/Despesas', category: 'engineering', icon: '💰', description: 'Controle financeiro de receitas e despesas' },
  { id: 'eng-services', name: 'Projetos (Templates)', category: 'engineering', icon: '🏷️', description: 'Templates e serviços padrão de engenharia' },
  { id: 'eng-employees', name: 'Colaboradores', category: 'engineering', icon: '👥', description: 'Colaboradores de engenharia' },
  { id: 'eng-ai-docs', name: 'Documentos IA', category: 'engineering', icon: '📄', description: 'Geração de documentos técnicos com IA' },

  { id: 'const-customers', name: 'Clientes', category: 'construction', icon: '👤', description: 'Clientes de obras' },
  { id: 'const-budgets', name: 'Orçamentos', category: 'construction', icon: '📋', description: 'Orçamentos paramétricos de obras' },
  { id: 'const-projects', name: 'Obras', category: 'construction', icon: '🏗️', description: 'Gestão de obras' },
  { id: 'const-finance', name: 'Financeiro', category: 'construction', icon: '💰', description: 'Financeiro de obras' },
];

export default function ModuleSharing() {
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [copied, setCopied] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'factory' | 'engineering' | 'construction'>('all');
  const [showUrlOptions, setShowUrlOptions] = useState(false);

  useEffect(() => {
    if (selectedModules.length > 0) {
      const baseUrl = customUrl || window.location.origin;
      const modules = selectedModules.join(',');
      const url = `${baseUrl}/?shared_modules=${modules}`;
      setShareUrl(url);

      QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0A7EC2',
          light: '#FFFFFF'
        }
      }).then(setQrCodeUrl);
    } else {
      setShareUrl('');
      setQrCodeUrl('');
    }
  }, [selectedModules, customUrl]);

  const toggleModule = (moduleId: string) => {
    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const selectAllInCategory = (category: 'factory' | 'engineering' | 'construction') => {
    const categoryModules = AVAILABLE_MODULES
      .filter(m => m.category === category)
      .map(m => m.id);

    const allSelected = categoryModules.every(id => selectedModules.includes(id));

    if (allSelected) {
      setSelectedModules(prev => prev.filter(id => !categoryModules.includes(id)));
    } else {
      setSelectedModules(prev => [...new Set([...prev, ...categoryModules])]);
    }
  };

  const copyToClipboard = async (url: string, type: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(type);
      setTimeout(() => setCopied(''), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const shareViaWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Sistema Aliancer - Módulos Compartilhados',
          text: 'Acesse os módulos selecionados do Sistema Aliancer',
          url: shareUrl,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.download = 'aliancer-qrcode.png';
    link.href = qrCodeUrl;
    link.click();
  };

  const filteredModules = selectedCategory === 'all'
    ? AVAILABLE_MODULES
    : AVAILABLE_MODULES.filter(m => m.category === selectedCategory);

  const categories = [
    { id: 'all', name: 'Todos', color: 'bg-gray-500' },
    { id: 'factory', name: 'Indústria', color: 'bg-blue-500' },
    { id: 'engineering', name: 'Engenharia', color: 'bg-green-500' },
    { id: 'construction', name: 'Construtora', color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Share2 className="w-8 h-8 text-[#0A7EC2]" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Compartilhar Módulos</h2>
            <p className="text-gray-600">Selecione os módulos que deseja compartilhar e gere um link personalizado</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtrar por Categoria</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedCategory === cat.id
                  ? `${cat.color} text-white shadow-md`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Módulos Disponíveis</h3>
          <div className="flex gap-2">
            {selectedCategory !== 'all' && (
              <button
                onClick={() => selectAllInCategory(selectedCategory as any)}
                className="px-3 py-1 text-sm bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-colors"
              >
                Selecionar Todos
              </button>
            )}
            {selectedModules.length > 0 && (
              <button
                onClick={() => setSelectedModules([])}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Limpar Seleção
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredModules.map((module) => {
            const isSelected = selectedModules.includes(module.id);
            const categoryColor =
              module.category === 'factory' ? 'border-blue-500 bg-blue-50' :
              module.category === 'engineering' ? 'border-green-500 bg-green-50' :
              'border-orange-500 bg-orange-50';

            return (
              <button
                key={module.id}
                onClick={() => toggleModule(module.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? `${categoryColor} shadow-md scale-105`
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{module.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {module.name}
                      {isSelected && (
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{module.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          {selectedModules.length} módulo(s) selecionado(s)
        </div>
      </div>

      {shareUrl && (
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-[#0A7EC2]" />
            Link de Compartilhamento
          </h3>

          {/* Configuração de URL Base */}
          <div className="bg-white rounded-lg p-4 mb-4 border-2 border-yellow-300">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">Configure o URL para Acesso via Smartphone</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Para acessar via smartphone, você precisa usar o IP da sua rede local em vez de "localhost"
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">URL Base:</label>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder={window.location.origin}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setCustomUrl('')}
                      className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-lg transition-all"
                    >
                      Localhost (atual)
                    </button>
                    <button
                      onClick={() => setCustomUrl('http://192.168.1.100:5173')}
                      className="px-3 py-1 text-xs bg-blue-200 hover:bg-blue-300 rounded-lg transition-all"
                    >
                      Exemplo: 192.168.1.100:5173
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    <strong>Como descobrir seu IP:</strong><br/>
                    • Windows: abra CMD e digite <code className="bg-gray-100 px-1 rounded">ipconfig</code><br/>
                    • Mac/Linux: abra Terminal e digite <code className="bg-gray-100 px-1 rounded">ifconfig</code><br/>
                    • Procure por "IPv4" ou "inet" - será algo como 192.168.x.x
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(shareUrl, 'link')}
                className="px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-all flex items-center gap-2 shadow-sm"
              >
                {copied === 'link' ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>

          {qrCodeUrl && (
            <div className="bg-white rounded-lg p-6 text-center">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-[#0A7EC2]" />
                QR Code para Acesso Rápido
              </h4>
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="mx-auto mb-4 rounded-lg shadow-sm"
              />
              <div className="flex gap-2 justify-center">
                <button
                  onClick={downloadQRCode}
                  className="px-4 py-2 bg-[#0A7EC2] text-white rounded-lg hover:bg-[#0968A8] transition-all flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Baixar QR Code
                </button>
                {navigator.share && (
                  <button
                    onClick={shareViaWebShare}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    Compartilhar
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-blue-100 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Como usar:</strong> Compartilhe este link ou QR Code com outras pessoas.
              Elas poderão acessar apenas os módulos selecionados do sistema.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
