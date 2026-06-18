import { useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Save, Loader2, FileDown, AlertCircle, RefreshCw,
  Building, Ruler, BarChart2
} from 'lucide-react';
import { Budget } from './types';
import { GalpaoVars, useGalpaoCalc } from './useGalpaoCalc';
import FloorPlanViewer from './FloorPlanViewer';
import CrossSectionViewer from './CrossSectionViewer';
import { gerarPacoteProducao } from './gerarPacoteProducao';

interface Props {
  budget: Budget;
  onRefresh: () => void;
}

const LABEL_CLS = 'block text-sm font-medium text-gray-700 mb-1';
const INPUT_CLS = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent';

export default function GalpaoPanel({ budget, onRefresh }: Props) {
  const [vars, setVars] = useState<GalpaoVars>({
    vao: (budget as any).vao_galpao ?? 0,
    comprimento: (budget as any).comprimento_total ?? 0,
    peDireito: (budget as any).pe_direito ?? 0,
    espacPilares: (budget as any).espac_pilares ?? 0,
    profFundacao: (budget as any).prof_fundacao ?? 0,
    tamanhoAba: (budget as any).tamanho_aba ?? 0.60,
    inclinacao: (budget as any).inclinacao_telhado ?? 27,
    tipoTelha: ((budget as any).tipo_telha ?? 'aluzinco') as 'aluzinco' | 'fibrocimento',
  });

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = useCallback((field: keyof GalpaoVars, value: number | string) => {
    setVars(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const bom = useGalpaoCalc(vars);

  const saveVars = async () => {
    setSaving(true); setError(null);
    try {
      const { error: err } = await supabase.from('budgets').update({
        vao_galpao: vars.vao || null,
        comprimento_total: vars.comprimento || null,
        pe_direito: vars.peDireito || null,
        espac_pilares: vars.espacPilares || null,
        prof_fundacao: vars.profFundacao || null,
        tamanho_aba: vars.tamanhoAba || null,
        inclinacao_telhado: vars.inclinacao,
        tipo_telha: vars.tipoTelha,
      }).eq('id', budget.id);
      if (err) throw err;
      setSaved(true);
      onRefresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGerarPacote = async () => {
    if (budget.status !== 'aprovado') {
      setError('O orçamento precisa estar APROVADO para gerar o pacote de produção.');
      return;
    }
    setGenerating(true); setError(null);
    try {
      await gerarPacoteProducao(budget, vars, bom);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const isAprovado = budget.status === 'aprovado';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-orange-500" />
            Variáveis do Galpão Pré-Moldado
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Defina as dimensões para gerar a planta, corte e pacote de produção.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={saveVars}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Salvo!' : 'Salvar Variáveis'}
          </button>
          <button
            onClick={handleGerarPacote}
            disabled={generating || !isAprovado}
            title={!isAprovado ? 'Aprove o orçamento para gerar o pacote' : 'Gerar PDF multipáginas'}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium disabled:opacity-50 ${
              isAprovado
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Gerar Pacote de Produção
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {!isAprovado && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Status atual: <strong>{budget.status}</strong>. Altere para <strong>Aprovado</strong> para habilitar o botão "Gerar Pacote de Produção".
        </div>
      )}

      {/* Form + Visualizers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Left: Form */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5" /> Dimensões Principais
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Vão do Galpão (m) *</label>
              <input type="number" min="0" step="0.1" value={vars.vao || ''}
                onChange={e => set('vao', parseFloat(e.target.value) || 0)}
                className={INPUT_CLS} placeholder="ex: 12" />
            </div>
            <div>
              <label className={LABEL_CLS}>Comprimento Total (m) *</label>
              <input type="number" min="0" step="0.1" value={vars.comprimento || ''}
                onChange={e => set('comprimento', parseFloat(e.target.value) || 0)}
                className={INPUT_CLS} placeholder="ex: 36" />
            </div>
            <div>
              <label className={LABEL_CLS}>Pé Direito (m) *</label>
              <input type="number" min="0" step="0.1" value={vars.peDireito || ''}
                onChange={e => set('peDireito', parseFloat(e.target.value) || 0)}
                className={INPUT_CLS} placeholder="ex: 4.5" />
            </div>
            <div>
              <label className={LABEL_CLS}>Espaç. entre Pilares (m) *</label>
              <input type="number" min="0" step="0.1" value={vars.espacPilares || ''}
                onChange={e => set('espacPilares', parseFloat(e.target.value) || 0)}
                className={INPUT_CLS} placeholder="ex: 6" />
            </div>
            <div>
              <label className={LABEL_CLS}>Prof. Fundação (m)</label>
              <input type="number" min="0" step="0.1" value={vars.profFundacao || ''}
                onChange={e => set('profFundacao', parseFloat(e.target.value) || 0)}
                className={INPUT_CLS} placeholder="ex: 1.2" />
            </div>
            <div>
              <label className={LABEL_CLS}>Tamanho da Aba (m)</label>
              <input type="number" min="0" step="0.05" value={vars.tamanhoAba || ''}
                onChange={e => set('tamanhoAba', parseFloat(e.target.value) || 0)}
                className={INPUT_CLS} placeholder="ex: 0.60" />
            </div>
            <div>
              <label className={LABEL_CLS}>Inclinação do Telhado (%)</label>
              <input type="number" min="5" max="60" step="1" value={vars.inclinacao || 27}
                onChange={e => set('inclinacao', parseFloat(e.target.value) || 27)}
                className={INPUT_CLS} />
            </div>
            <div>
              <label className={LABEL_CLS}>Tipo de Telha</label>
              <select value={vars.tipoTelha}
                onChange={e => set('tipoTelha', e.target.value as any)}
                className={INPUT_CLS}>
                <option value="aluzinco">Aluzinco</option>
                <option value="fibrocimento">Fibrocimento</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Floor Plan */}
        <FloorPlanViewer vars={vars} />
      </div>

      {/* Cross section below */}
      <CrossSectionViewer
        vars={vars}
        tercas={bom.tercas}
        comprimentoInclinado={bom.comprimentoInclinado}
      />

      {/* BOM Summary */}
      {bom.numPorticos > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" /> Resumo Executivo — Quantitativos de Cobertura
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'Pórticos', value: bom.numPorticos, unit: 'un' },
              { label: 'Comp. Inclinado', value: bom.comprimentoInclinado.toFixed(2), unit: 'm' },
              { label: 'Terças/lado', value: bom.tercas.length, unit: 'x2' },
              { label: 'Total de Terças', value: bom.numTercas, unit: 'un' },
              { label: 'Telhas (total)', value: bom.totalTelhas, unit: 'un' },
              { label: 'Cumeeiras', value: bom.numCumeeiras, unit: 'un' },
              { label: 'Pontaletes', value: bom.numPontaletes, unit: 'un' },
              { label: 'Parafusos', value: bom.parafusosTercas, unit: 'un' },
            ].map(item => (
              <div key={item.label} className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-lg font-bold text-orange-700">{item.value}
                  <span className="text-xs font-normal text-orange-500 ml-1">{item.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Tercas locacao table */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gabarito de Locação das Terças</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-violet-600 text-white">
                    <th className="px-3 py-2 text-left font-medium">Terça</th>
                    <th className="px-3 py-2 text-right font-medium">Dist. da Aba (m)</th>
                    <th className="px-3 py-2 text-right font-medium">Cota (m)</th>
                    <th className="px-3 py-2 text-right font-medium">Espaç. próxima (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.tercas.map((t, i) => {
                    const next = bom.tercas[i + 1];
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-violet-50'}>
                        <td className="px-3 py-1.5 font-medium text-gray-700">T-{String(i + 1).padStart(2, '0')}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600">{t.distanciaAba.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600">{t.cota.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400">
                          {next ? (next.cota - t.cota).toFixed(3) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
