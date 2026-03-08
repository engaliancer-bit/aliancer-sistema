import { useEffect, useState } from 'react';
import { Package, Calendar, Truck, Hammer, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { supabase, ProductTracking } from '../lib/supabase';

interface ProductionStage {
  id: string;
  stage_key: string;
  stage_name: string;
  stage_order: number;
  description: string;
}

interface TrackingStage {
  id: string;
  stage_id: string;
  completed_at: string;
  completed_by: string;
  photo_url: string | null;
  notes: string | null;
  production_stages?: ProductionStage;
}

interface ExtendedTracking extends ProductTracking {
  products?: {
    name: string;
    unit: string;
    enable_stage_tracking?: boolean;
  };
  production_tracking_stages?: TrackingStage[];
}

interface PublicQRViewProps {
  token: string;
}

export default function PublicQRView({ token }: PublicQRViewProps) {
  const [tracking, setTracking] = useState<ExtendedTracking | null>(null);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrackingData();
  }, [token]);

  const loadTrackingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('product_tracking')
        .select(`
          *,
          products (
            name,
            unit,
            enable_stage_tracking
          ),
          production_tracking_stages (
            *,
            production_stages (*)
          )
        `)
        .eq('qr_token', token)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Produto não encontrado');
        return;
      }

      setTracking(data);

      if (data.products?.enable_stage_tracking) {
        const { data: stagesData } = await supabase
          .from('production_stages')
          .select('*')
          .order('stage_order');

        setStages(stagesData || []);
      }
    } catch (err) {
      console.error('Erro ao carregar rastreamento:', err);
      setError('Erro ao carregar informações do produto');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Não informado';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Carregando informações...</p>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Produto não encontrado</h2>
          <p className="text-gray-600">{error || 'Não foi possível localizar as informações deste produto.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-8 h-8" />
              <h1 className="text-3xl font-bold">Rastreamento de Produto</h1>
            </div>
            <p className="text-blue-100">Informações detalhadas sobre a produção</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-600">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                {tracking.products?.name || 'Produto'}
              </h2>
              <p className="text-gray-600">
                Traço: <span className="font-semibold">{tracking.recipe_name}</span>
              </p>
              <p className="text-gray-600">
                Quantidade: <span className="font-semibold">{tracking.quantity} {tracking.products?.unit}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-800">Data de Produção</h3>
                </div>
                <p className="text-lg text-gray-700">{formatDate(tracking.production_date)}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-800">Data de Expedição</h3>
                </div>
                <p className={`text-lg ${tracking.expedition_date ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                  {formatDate(tracking.expedition_date)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Hammer className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-800">Data de Montagem</h3>
                </div>
                <p className={`text-lg ${tracking.assembly_date ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                  {formatDate(tracking.assembly_date)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-800">Código de Rastreamento</h3>
                </div>
                <p className="text-sm text-gray-600 font-mono break-all">{tracking.qr_token.slice(0, 16)}...</p>
              </div>
            </div>

            {tracking.products?.enable_stage_tracking && stages.length > 0 && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Etapas de Produção</h3>
                <div className="space-y-3">
                  {stages.map((stage, index) => {
                    const completedStage = tracking.production_tracking_stages?.find(
                      (ts) => ts.stage_id === stage.id
                    );
                    const isCompleted = !!completedStage;

                    return (
                      <div
                        key={stage.id}
                        className={`rounded-lg p-4 border-2 ${
                          isCompleted
                            ? 'bg-green-50 border-green-300'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {isCompleted ? (
                              <CheckCircle className="w-6 h-6 text-green-600" />
                            ) : (
                              <Clock className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-500">
                                {index + 1}.
                              </span>
                              <h4 className="font-semibold text-gray-900">{stage.stage_name}</h4>
                            </div>
                            {stage.description && (
                              <p className="text-sm text-gray-600 mb-2">{stage.description}</p>
                            )}
                            {completedStage && (
                              <div className="text-sm space-y-1 mt-2 bg-white bg-opacity-50 rounded p-3">
                                <div className="text-green-700">
                                  <span className="font-medium">Concluída em:</span>{' '}
                                  {new Date(completedStage.completed_at).toLocaleString('pt-BR')}
                                </div>
                                <div className="text-green-700">
                                  <span className="font-medium">Responsável:</span>{' '}
                                  {completedStage.completed_by}
                                </div>
                                {completedStage.notes && (
                                  <div className="text-green-700">
                                    <span className="font-medium">Observações:</span>{' '}
                                    {completedStage.notes}
                                  </div>
                                )}
                                {completedStage.photo_url && (
                                  <div className="mt-2">
                                    <img
                                      src={completedStage.photo_url}
                                      alt={`Foto da etapa ${stage.stage_name}`}
                                      className="rounded-lg max-w-full h-auto border border-green-200"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tracking.additional_notes && (
              <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-yellow-600" />
                  Observações
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">{tracking.additional_notes}</p>
              </div>
            )}

            <div className="bg-gray-100 rounded-lg p-4 text-center text-sm text-gray-600">
              <p>Última atualização: {formatDate(tracking.updated_at)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-gray-600 text-sm">
          <p>Este QR code contém informações públicas sobre o produto.</p>
          <p>As informações são atualizadas conforme o produto passa pelas etapas de produção.</p>
        </div>
      </div>
    </div>
  );
}
