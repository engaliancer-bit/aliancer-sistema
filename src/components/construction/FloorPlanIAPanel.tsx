import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Upload, Sparkles, CheckCircle, XCircle, Edit2, X, Save,
  AlertCircle, ImageIcon, RefreshCw, Info, ChevronDown, ChevronRight,
  Loader, Eye, Clock, Zap, Brain
} from 'lucide-react';
import { Budget, WBSStep, ELEMENT_DEFS, ELEMENT_CATEGORIES, fmtQty } from './types';

interface Props {
  budget: Budget;
  wbsSteps: WBSStep[];
  onRefresh: () => void;
}

interface Floorplan {
  id: string;
  budget_id: string;
  file_name: string;
  file_type: string;
  file_size_kb: number | null;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  error_message: string | null;
  ia_model: string | null;
  processing_started_at: string | null;
  processing_finished_at: string | null;
  elements_suggested: number;
  elements_confirmed: number;
  notes: string | null;
  created_at: string;
}

interface IASuggestion {
  id: string;
  budget_id: string;
  floorplan_id: string | null;
  element_type: string;
  label: string;
  room: string | null;
  params: Record<string, number>;
  calculated_quantity: number;
  calculated_unit: string;
  calc_summary: string | null;
  ia_confidence: number | null;
  ia_reasoning: string | null;
  status: 'pendente' | 'confirmado' | 'editado' | 'ignorado';
  converted_element_id: string | null;
  wbs_step_id: string | null;
}

const CONF_COLOR = (c: number | null) => {
  if (!c) return 'text-gray-400';
  if (c >= 0.8) return 'text-green-600';
  if (c >= 0.6) return 'text-amber-600';
  return 'text-red-500';
};

const CONF_BG = (c: number | null) => {
  if (!c) return 'bg-gray-100';
  if (c >= 0.8) return 'bg-green-100';
  if (c >= 0.6) return 'bg-amber-100';
  return 'bg-red-100';
};

export default function FloorPlanIAPanel({ budget, wbsSteps, onRefresh }: Props) {
  const [floorplans, setFloorplans] = useState<Floorplan[]>([]);
  const [suggestions, setSuggestions] = useState<IASuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSuggestion, setEditingSuggestion] = useState<IASuggestion | null>(null);
  const [editForm, setEditForm] = useState<{ label: string; params: Record<string, number>; wbs_step_id: string }>({
    label: '', params: {}, wbs_step_id: '',
  });
  const [expandedFloorplan, setExpandedFloorplan] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('pendente');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: fp }, { data: sug }] = await Promise.all([
      supabase.from('budget_floorplans')
        .select('id,budget_id,file_name,file_type,file_size_kb,status,error_message,ia_model,processing_started_at,processing_finished_at,elements_suggested,elements_confirmed,notes,created_at')
        .eq('budget_id', budget.id)
        .limit(100)
        .order('created_at', { ascending: false }),
      supabase.from('budget_ia_suggestions')
        .select('id,budget_id,floorplan_id,element_type,label,room,params,calculated_quantity,calculated_unit,calc_summary,ia_confidence,ia_reasoning,status,converted_element_id,wbs_step_id')
        .eq('budget_id', budget.id)
        .limit(500)
        .order('created_at'),
    ]);
    setFloorplans(fp || []);
    setSuggestions(sug || []);
    if (fp && fp.length > 0 && !expandedFloorplan) {
      setExpandedFloorplan(fp[0].id);
    }
    setLoading(false);
  }, [budget.id, expandedFloorplan]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const processing = floorplans.some(f => f.status === 'processando');
    if (!processing) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('budget_floorplans')
        .select('id,budget_id,file_name,status,elements_suggested,elements_confirmed,created_at,error_message,processing_started_at')
        .eq('budget_id', budget.id)
        .limit(100)
        .order('created_at', { ascending: false });

      setFloorplans(data || []);
      const stillProcessing = (data || []).some((f: Floorplan) => f.status === 'processando');
      if (!stillProcessing && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [budget.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setError('Formato nao suportado. Use JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Arquivo muito grande. Maximo 20MB.');
      return;
    }

    setError(null);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Full = ev.target?.result as string;
      const base64 = base64Full.split(',')[1];
      setImagePreview(base64Full);

      const { data: fp, error: fpErr } = await supabase
        .from('budget_floorplans')
        .insert([{
          budget_id: budget.id,
          file_name: file.name,
          file_type: file.type,
          file_size_kb: Math.round(file.size / 1024),
          file_base64: base64,
          status: 'pendente',
        }])
        .select()
        .maybeSingle();

      if (fpErr || !fp) {
        setError('Erro ao salvar planta: ' + (fpErr?.message || 'desconhecido'));
        setUploading(false);
        return;
      }

      setFloorplans(prev => [fp, ...prev]);
      setExpandedFloorplan(fp.id);
      setUploading(false);
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const runAnalysis = async (fp: Floorplan) => {
    if (!apiKey.trim() && !showApiKeyInput) {
      setShowApiKeyInput(true);
      return;
    }
    if (!apiKey.trim()) {
      setError('Informe a chave da API OpenAI para continuar.');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const { data: fpData } = await supabase
        .from('budget_floorplans')
        .select('file_base64')
        .eq('id', fp.id)
        .maybeSingle();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-floorplan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          floorplan_id: fp.id,
          budget_id: budget.id,
          image_base64: fpData?.file_base64,
          ai_api_key: apiKey.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Erro na analise');
      } else {
        setShowApiKeyInput(false);
        await load();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const confirmSuggestion = async (sug: IASuggestion) => {
    setSaving(true);
    const { data: el } = await supabase
      .from('budget_elements')
      .insert([{
        budget_id: sug.budget_id,
        wbs_step_id: sug.wbs_step_id || wbsSteps[0]?.id || null,
        element_type: sug.element_type,
        label: sug.label,
        params: sug.params,
        notes: sug.ia_reasoning || null,
        source: 'planta_ia',
        ia_confidence: sug.ia_confidence,
        room: sug.room,
        measurement_status: 'confirmado',
      }])
      .select()
      .maybeSingle();

    if (el) {
      await supabase
        .from('budget_ia_suggestions')
        .update({ status: 'confirmado', converted_element_id: el.id })
        .eq('id', sug.id);
      setSuggestions(prev => prev.map(s => s.id === sug.id ? { ...s, status: 'confirmado', converted_element_id: el.id } : s));
      onRefresh();
    }
    setSaving(false);
  };

  const ignoreSuggestion = async (id: string) => {
    await supabase.from('budget_ia_suggestions').update({ status: 'ignorado' }).eq('id', id);
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status: 'ignorado' } : s));
  };

  const openEdit = (sug: IASuggestion) => {
    setEditingSuggestion(sug);
    setEditForm({
      label: sug.label,
      params: { ...sug.params },
      wbs_step_id: sug.wbs_step_id || wbsSteps[0]?.id || '',
    });
  };

  const saveEdit = async () => {
    if (!editingSuggestion) return;
    setSaving(true);
    await supabase
      .from('budget_ia_suggestions')
      .update({ label: editForm.label, params: editForm.params, wbs_step_id: editForm.wbs_step_id || null, status: 'editado' })
      .eq('id', editingSuggestion.id);
    setSuggestions(prev => prev.map(s =>
      s.id === editingSuggestion.id
        ? { ...s, label: editForm.label, params: editForm.params, wbs_step_id: editForm.wbs_step_id, status: 'editado' }
        : s
    ));
    setEditingSuggestion(null);
    setSaving(false);
  };

  const confirmAll = async (fpId: string) => {
    const pending = suggestions.filter(s => s.floorplan_id === fpId && (s.status === 'pendente' || s.status === 'editado'));
    if (pending.length === 0) return;
    if (!confirm(`Confirmar ${pending.length} sugestoes e adicionar como elementos do orcamento?`)) return;
    setSaving(true);
    for (const sug of pending) {
      await confirmSuggestion(sug);
    }
    setSaving(false);
    onRefresh();
  };

  const filteredSuggestions = (fpId: string) =>
    suggestions.filter(s => s.floorplan_id === fpId && (filterStatus === 'all' || s.status === filterStatus));

  const pendingCount = (fpId: string) =>
    suggestions.filter(s => s.floorplan_id === fpId && s.status === 'pendente').length;

  const confirmedCount = (fpId: string) =>
    suggestions.filter(s => s.floorplan_id === fpId && s.status === 'confirmado').length;

  return (
    <div className="space-y-5">
      {/* Cabecalho + upload */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Analise de Planta Baixa por IA</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Envie uma imagem da planta baixa e a IA identificara automaticamente os elementos construtivos.
              Voce revisara e confirmara cada sugestao antes de adicionar ao orcamento.
            </p>
            <div className="flex items-center gap-3 mt-3 text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Requer chave da API OpenAI (GPT-4o Vision). As sugestoes da IA nunca sao adicionadas automaticamente — voce revisa e confirma cada uma.</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-dashed border-blue-300 rounded-xl text-sm text-blue-600 font-medium hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50">
            {uploading ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Enviando...' : 'Enviar Planta Baixa'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

          <button
            onClick={() => setShowApiKeyInput(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all">
            <Zap className="w-4 h-4 text-amber-500" />
            {apiKey ? 'Chave configurada' : 'Configurar API Key'}
          </button>
        </div>

        {showApiKeyInput && (
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
            <button
              onClick={() => { if (apiKey.trim()) setShowApiKeyInput(false); }}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
              Salvar
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-0.5 hover:bg-red-100 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : floorplans.length === 0 ? (
        <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-xl">
          <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma planta enviada</p>
          <p className="text-gray-400 text-sm mt-1">Envie uma imagem de planta baixa para comecar a analise.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filtro de status de sugestoes */}
          <div className="flex gap-2 flex-wrap">
            {['pendente', 'editado', 'confirmado', 'ignorado', 'all'].map(s => (
              <button key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {s === 'all' ? 'Todos' : s === 'pendente' ? 'Pendentes' : s === 'editado' ? 'Editados' : s === 'confirmado' ? 'Confirmados' : 'Ignorados'}
              </button>
            ))}
          </div>

          {floorplans.map(fp => {
            const isOpen = expandedFloorplan === fp.id;
            const fpSuggestions = filteredSuggestions(fp.id);
            const pending = pendingCount(fp.id);
            const confirmed = confirmedCount(fp.id);

            return (
              <div key={fp.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Header da planta */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedFloorplan(isOpen ? null : fp.id)}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <ImageIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">{fp.file_name}</span>
                    {fp.file_size_kb && <span className="text-xs text-gray-400 flex-shrink-0">{fp.file_size_kb}KB</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {fp.status === 'processando' && (
                      <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        <Loader className="w-3 h-3 animate-spin" /> Analisando...
                      </span>
                    )}
                    {fp.status === 'concluido' && (
                      <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> {fp.elements_suggested} sugest.
                      </span>
                    )}
                    {fp.status === 'pendente' && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Aguardando analise</span>
                    )}
                    {fp.status === 'erro' && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        <XCircle className="w-3 h-3" /> Erro
                      </span>
                    )}
                    {pending > 0 && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {pending} pendente(s)
                      </span>
                    )}
                    {confirmed > 0 && (
                      <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        {confirmed} confirmado(s)
                      </span>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="p-4 space-y-4">
                    {/* Status / erro / notas da IA */}
                    {fp.status === 'erro' && fp.error_message && (
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{fp.error_message}</span>
                      </div>
                    )}

                    {fp.notes && fp.status === 'concluido' && (
                      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                        <Brain className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{fp.notes}</span>
                      </div>
                    )}

                    {/* Acoes */}
                    <div className="flex flex-wrap gap-2">
                      {(fp.status === 'pendente' || fp.status === 'erro') && (
                        <button
                          onClick={() => runAnalysis(fp)}
                          disabled={analyzing}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 shadow-sm">
                          {analyzing ? <Loader className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {analyzing ? 'Analisando...' : 'Analisar com IA'}
                        </button>
                      )}
                      {pending > 0 && (
                        <button
                          onClick={() => confirmAll(fp.id)}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50">
                          <CheckCircle className="w-4 h-4" />
                          Confirmar Todos ({pending})
                        </button>
                      )}
                      <button
                        onClick={load}
                        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Lista de sugestoes */}
                    {fpSuggestions.length === 0 && fp.status === 'concluido' && (
                      <p className="text-center text-sm text-gray-400 py-6">
                        {filterStatus !== 'all' ? `Nenhuma sugestao com status "${filterStatus}".` : 'Nenhuma sugestao gerada.'}
                      </p>
                    )}

                    {fpSuggestions.length > 0 && (
                      <div className="space-y-2">
                        {fpSuggestions.map(sug => {
                          const def = ELEMENT_DEFS.find(d => d.value === sug.element_type);
                          const catKey = def?.category || 'outros';
                          const cat = ELEMENT_CATEGORIES[catKey];
                          const isConfirmed = sug.status === 'confirmado';
                          const isIgnored = sug.status === 'ignorado';

                          return (
                            <div key={sug.id}
                              className={`rounded-xl border p-4 transition-all ${
                                isConfirmed ? 'border-green-200 bg-green-50/30' :
                                isIgnored ? 'border-gray-100 bg-gray-50 opacity-50' :
                                sug.status === 'editado' ? 'border-blue-200 bg-blue-50/30' :
                                'border-gray-200 bg-white'
                              }`}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${cat.bg} ${cat.color}`}>
                                      {def?.label || sug.element_type}
                                    </span>
                                    <span className="font-semibold text-gray-900 text-sm">{sug.label}</span>
                                    {sug.room && (
                                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                        {sug.room}
                                      </span>
                                    )}
                                    {sug.wbs_step_id && (
                                      <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                        {wbsSteps.find(w => w.id === sug.wbs_step_id)?.code || ''}
                                      </span>
                                    )}
                                  </div>

                                  {/* Parametros */}
                                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 mb-1">
                                    {def?.params.map(p => sug.params[p.key] !== undefined && (
                                      <span key={p.key} className="bg-gray-100 px-1.5 py-0.5 rounded">
                                        {p.label.split(' ')[0]}: {sug.params[p.key]}{p.unit}
                                      </span>
                                    ))}
                                  </div>

                                  {/* Raciocinio IA */}
                                  {sug.ia_reasoning && (
                                    <p className="text-[11px] text-gray-400 italic mt-1 line-clamp-2">{sug.ia_reasoning}</p>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                  {/* Confianca */}
                                  {sug.ia_confidence !== null && (
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CONF_BG(sug.ia_confidence)} ${CONF_COLOR(sug.ia_confidence)}`}>
                                      {Math.round((sug.ia_confidence || 0) * 100)}% conf.
                                    </span>
                                  )}

                                  {/* Status badge */}
                                  {isConfirmed && (
                                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                                      <CheckCircle className="w-3 h-3" /> Confirmado
                                    </span>
                                  )}
                                  {isIgnored && (
                                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                      <XCircle className="w-3 h-3" /> Ignorado
                                    </span>
                                  )}
                                  {sug.status === 'editado' && (
                                    <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                      <Edit2 className="w-3 h-3" /> Editado
                                    </span>
                                  )}
                                  {sug.status === 'pendente' && (
                                    <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                      <Clock className="w-3 h-3" /> Pendente
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Acoes por sugestao */}
                              {!isConfirmed && !isIgnored && (
                                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                                  <button
                                    onClick={() => confirmSuggestion(sug)}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 disabled:opacity-50">
                                    <CheckCircle className="w-3.5 h-3.5" /> Confirmar
                                  </button>
                                  <button
                                    onClick={() => openEdit(sug)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50">
                                    <Edit2 className="w-3.5 h-3.5" /> Editar e Confirmar
                                  </button>
                                  <button
                                    onClick={() => ignoreSuggestion(sug.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50">
                                    <X className="w-3.5 h-3.5" /> Ignorar
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edicao */}
      {editingSuggestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b rounded-t-2xl px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Editar Sugestao da IA</h3>
              <button onClick={() => setEditingSuggestion(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* IA reasoning */}
              {editingSuggestion.ia_reasoning && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <Brain className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{editingSuggestion.ia_reasoning}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Identificacao</label>
                <input
                  value={editForm.label}
                  onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etapa WBS</label>
                <select
                  value={editForm.wbs_step_id}
                  onChange={e => setEditForm(p => ({ ...p, wbs_step_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Sem etapa</option>
                  {wbsSteps.map(w => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Parametros</label>
                <div className="grid grid-cols-2 gap-3">
                  {(ELEMENT_DEFS.find(d => d.value === editingSuggestion.element_type)?.params || []).map(p => (
                    <div key={p.key}>
                      <label className="block text-xs text-gray-600 mb-1">{p.label}</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={editForm.params[p.key] ?? ''}
                          onChange={e => setEditForm(prev => ({
                            ...prev,
                            params: { ...prev.params, [p.key]: parseFloat(e.target.value) || 0 }
                          }))}
                          step={p.step || 0.01} min={0}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pr-9 focus:ring-2 focus:ring-blue-400"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{p.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setEditingSuggestion(null)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={async () => { await saveEdit(); await confirmSuggestion({ ...editingSuggestion, label: editForm.label, params: editForm.params, wbs_step_id: editForm.wbs_step_id }); }}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Salvar e Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
