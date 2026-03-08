import { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle, Clock, Upload, X, QrCode, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

interface ProductTracking {
  id: string;
  qr_token: string;
  product_id: string;
  production_date: string;
  quantity: number;
  order_number?: number;
  customer_name?: string;
  products?: {
    name: string;
    enable_stage_tracking: boolean;
  };
  production_tracking_stages?: TrackingStage[];
}

export default function ProductionStageTracker() {
  const [qrToken, setQrToken] = useState('');
  const [tracking, setTracking] = useState<ProductTracking | null>(null);
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [selectedStage, setSelectedStage] = useState<ProductionStage | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadStages();
    const savedName = localStorage.getItem('responsible_name');
    if (savedName) {
      setResponsibleName(savedName);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const loadStages = async () => {
    try {
      const { data, error } = await supabase
        .from('production_stages')
        .select('*')
        .order('stage_order');

      if (error) throw error;
      setStages(data || []);
    } catch (error) {
      console.error('Erro ao carregar etapas:', error);
    }
  };

  const handleSearch = async () => {
    if (!qrToken.trim()) {
      alert('Digite o código QR');
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('product_tracking')
        .select(`
          *,
          products(name, enable_stage_tracking),
          production_tracking_stages(
            *,
            production_stages(*)
          )
        `)
        .eq('qr_token', qrToken.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        alert('QR Code não encontrado');
        return;
      }

      if (!data.products?.enable_stage_tracking) {
        alert('Este produto não possui acompanhamento de etapas ativado');
        return;
      }

      setTracking(data);

      const completed = new Set<string>();
      data.production_tracking_stages?.forEach((ts: TrackingStage) => {
        completed.add(ts.stage_id);
      });
      setCompletedStages(completed);
    } catch (error: any) {
      console.error('Erro ao buscar tracking:', error);
      alert(`Erro ao buscar produto: ${error.message}`);
    } finally {
      setSearching(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }

      setShowCamera(true);
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      alert('Não foi possível acessar a câmera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  const uploadPhoto = async (imageData: string): Promise<string | null> => {
    try {
      const base64Data = imageData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `${tracking?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('production-stages')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('production-stages')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      return null;
    }
  };

  const handleCompleteStage = async () => {
    if (!selectedStage || !tracking || !responsibleName.trim()) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    if (completedStages.has(selectedStage.id)) {
      alert('Esta etapa já foi concluída');
      return;
    }

    setLoading(true);
    try {
      let photoUrl: string | null = null;

      if (capturedImage) {
        photoUrl = await uploadPhoto(capturedImage);
      }

      const { error } = await supabase
        .from('production_tracking_stages')
        .insert({
          tracking_id: tracking.id,
          stage_id: selectedStage.id,
          completed_by: responsibleName,
          photo_url: photoUrl,
          notes: notes || null,
        });

      if (error) throw error;

      localStorage.setItem('responsible_name', responsibleName);

      alert(`Etapa "${selectedStage.stage_name}" concluída com sucesso!`);

      setCompletedStages(new Set([...completedStages, selectedStage.id]));
      setSelectedStage(null);
      setCapturedImage(null);
      setNotes('');

      await handleSearch();
    } catch (error: any) {
      console.error('Erro ao registrar etapa:', error);
      alert(`Erro ao registrar etapa: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getNextPendingStage = (): ProductionStage | null => {
    const pending = stages.find((stage) => !completedStages.has(stage.id));
    return pending || null;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <QrCode className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            Acompanhamento de Etapas de Produção
          </h2>
        </div>

        <div className="flex gap-3 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Digite ou escaneie o código QR da peça"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Search className="w-5 h-5" />
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {tracking && (
          <div className="border-t border-gray-200 pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">
                {tracking.products?.name}
              </h3>
              <div className="text-sm text-blue-800 space-y-1">
                <div>
                  <span className="font-medium">Data de Produção:</span>{' '}
                  {new Date(tracking.production_date).toLocaleDateString('pt-BR')}
                </div>
                {tracking.order_number && (
                  <div>
                    <span className="font-medium">Ordem:</span> #{tracking.order_number}
                  </div>
                )}
                {tracking.customer_name && (
                  <div>
                    <span className="font-medium">Cliente:</span> {tracking.customer_name}
                  </div>
                )}
                <div>
                  <span className="font-medium">Quantidade:</span> {tracking.quantity} unidades
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-4">Etapas do Processo</h4>
              <div className="space-y-3">
                {stages.map((stage, index) => {
                  const isCompleted = completedStages.has(stage.id);
                  const completedData = tracking.production_tracking_stages?.find(
                    (ts) => ts.stage_id === stage.id
                  );

                  return (
                    <div
                      key={stage.id}
                      className={`border rounded-lg p-4 ${
                        isCompleted
                          ? 'bg-green-50 border-green-300'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-medium text-gray-500">
                              {index + 1}.
                            </span>
                            <h5 className="font-semibold text-gray-900">{stage.stage_name}</h5>
                            {isCompleted ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          {stage.description && (
                            <p className="text-sm text-gray-600 ml-7 mb-2">{stage.description}</p>
                          )}
                          {completedData && (
                            <div className="text-xs text-green-700 ml-7 space-y-1">
                              <div>
                                <span className="font-medium">Concluída em:</span>{' '}
                                {new Date(completedData.completed_at).toLocaleString('pt-BR')}
                              </div>
                              <div>
                                <span className="font-medium">Por:</span>{' '}
                                {completedData.completed_by}
                              </div>
                              {completedData.notes && (
                                <div>
                                  <span className="font-medium">Obs:</span> {completedData.notes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {!isCompleted && (
                          <button
                            onClick={() => setSelectedStage(stage)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Concluir
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedStage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Concluir Etapa: {selectedStage.stage_name}
                </h3>
                <button
                  onClick={() => {
                    setSelectedStage(null);
                    setCapturedImage(null);
                    stopCamera();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Responsável *
                  </label>
                  <input
                    type="text"
                    value={responsibleName}
                    onChange={(e) => setResponsibleName(e.target.value)}
                    placeholder="Digite seu nome"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Foto da Etapa (Opcional)
                  </label>

                  {!showCamera && !capturedImage && (
                    <button
                      onClick={startCamera}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-gray-600"
                    >
                      <Camera className="w-5 h-5" />
                      Abrir Câmera
                    </button>
                  )}

                  {showCamera && (
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full rounded-lg"
                      />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                        <button
                          onClick={capturePhoto}
                          className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <Camera className="w-5 h-5" />
                          Capturar
                        </button>
                        <button
                          onClick={stopCamera}
                          className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="relative">
                      <img
                        src={capturedImage}
                        alt="Foto capturada"
                        className="w-full rounded-lg"
                      />
                      <button
                        onClick={() => {
                          setCapturedImage(null);
                          startCamera();
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações (Opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Adicione observações sobre esta etapa"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCompleteStage}
                    disabled={loading || !responsibleName.trim()}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    {loading ? 'Salvando...' : 'Concluir Etapa'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedStage(null);
                      setCapturedImage(null);
                      stopCamera();
                    }}
                    className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
