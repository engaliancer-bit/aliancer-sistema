import React, { memo, useMemo } from 'react';
import { GalpaoVars, TercaLocacao } from './useGalpaoCalc';

interface Props {
  vars: GalpaoVars;
  tercas: TercaLocacao[];
  comprimentoInclinado: number;
}

const CrossSectionViewer = memo(function CrossSectionViewer({ vars, tercas, comprimentoInclinado }: Props) {
  const { vao, peDireito, profFundacao, inclinacao, tipoTelha } = vars;

  const ready = vao > 0 && peDireito > 0;

  const dims = useMemo(() => {
    const margin = 55;
    const cotaOff = 30;
    const vwW = 540;
    const vwH = 360;
    const drawW = vwW - margin * 2 - cotaOff * 2;
    const drawH = vwH - margin * 2 - cotaOff;

    // total height displayed: peDireito + ridge height + profFundacao
    const slope = inclinacao / 100;
    const ridgeHeight = (vao / 2) * slope;
    const totalHeight = peDireito + ridgeHeight + (profFundacao || 0.5);
    const scaleX = drawW / vao;
    const scaleY = drawH / totalHeight;

    // origin: bottom-centre at ground level
    const ox = vwW / 2;
    const oy = vwH - margin - cotaOff + (profFundacao || 0.5) * scaleY;

    return { vwW, vwH, margin, cotaOff, scaleX, scaleY, ridgeHeight, ox, oy, totalHeight };
  }, [vao, peDireito, profFundacao, inclinacao]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <p className="text-sm text-gray-400">Preencha Vao e Pe Direito para ver o corte</p>
      </div>
    );
  }

  const { vwW, vwH, scaleX, scaleY, ridgeHeight, ox, oy } = dims;
  const halfVao = (vao / 2) * scaleX;
  const peD = peDireito * scaleY;
  const profF = (profFundacao || 0.5) * scaleY;
  const ridgeH = ridgeHeight * scaleY;

  // Key points
  const leftBase = { x: ox - halfVao, y: oy };
  const rightBase = { x: ox + halfVao, y: oy };
  const leftTop = { x: ox - halfVao, y: oy - peD };
  const rightTop = { x: ox + halfVao, y: oy - peD };
  const ridge = { x: ox, y: oy - peD - ridgeH };

  // Terca dots along inclined rafter — left side
  const slope = inclinacao / 100;
  const rafterLen = (vao / 2) * Math.sqrt(1 + slope * slope);

  const tercaDots = tercas.map(t => {
    const frac = Math.min(1, t.cota / comprimentoInclinado);
    const dx = frac * halfVao;
    const dy = frac * ridgeH;
    return {
      lx: leftTop.x + dx,
      ly: leftTop.y - dy,
      rx: rightTop.x - dx,
      ry: rightTop.y - dy,
    };
  });

  // Aba extension
  const abaScale = vars.tamanhoAba * scaleX;
  const abaLeftX = leftTop.x - abaScale;
  const abaRightX = rightTop.x + abaScale;
  // slope continuation for aba
  const abaDyLeft = vars.tamanhoAba * slope * scaleY;
  const abaLeftY = leftTop.y + abaDyLeft; // drops down from leftTop
  const abaRightY = rightTop.y + abaDyLeft;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Corte Transversal</p>
      <svg
        viewBox={`0 0 ${vwW} ${vwH}`}
        width="100%"
        style={{ maxHeight: 320 }}
      >
        <rect width={vwW} height={vwH} fill="#f9fafb" rx={8} />

        {/* Ground line */}
        <line x1={20} y1={oy} x2={vwW - 20} y2={oy}
          stroke="#6b7280" strokeWidth={1} strokeDasharray="6 4" />

        {/* Foundation blocks */}
        {[leftBase.x, rightBase.x].map((bx, i) => (
          <rect key={i} x={bx - 8} y={oy} width={16} height={profF}
            fill="#9ca3af" stroke="#6b7280" strokeWidth={1} />
        ))}

        {/* Columns (pilares) */}
        <rect x={leftTop.x - 5} y={leftTop.y} width={10} height={peD}
          fill="#dbeafe" stroke="#1e40af" strokeWidth={1.5} />
        <rect x={rightTop.x - 5} y={rightTop.y} width={10} height={peD}
          fill="#dbeafe" stroke="#1e40af" strokeWidth={1.5} />

        {/* Rafter left (with aba) */}
        <line x1={abaLeftX} y1={abaLeftY} x2={ridge.x} y2={ridge.y}
          stroke="#374151" strokeWidth={2.5} />
        {/* Rafter right (with aba) */}
        <line x1={abaRightX} y1={abaRightY} x2={ridge.x} y2={ridge.y}
          stroke="#374151" strokeWidth={2.5} />

        {/* Terca marks */}
        {tercaDots.map((d, i) => (
          <g key={i}>
            <rect x={d.lx - 3} y={d.ly - 3} width={6} height={4}
              fill="#f97316" stroke="#ea580c" strokeWidth={0.8} rx={1} />
            <rect x={d.rx - 3} y={d.ry - 3} width={6} height={4}
              fill="#f97316" stroke="#ea580c" strokeWidth={0.8} rx={1} />
          </g>
        ))}

        {/* Ridge marker */}
        <circle cx={ridge.x} cy={ridge.y} r={4} fill="#7c3aed" />

        {/* ── Cotas ── */}

        {/* Vao */}
        <line x1={leftTop.x} y1={oy + profF + 18} x2={rightTop.x} y2={oy + profF + 18}
          stroke="#f97316" strokeWidth={1} />
        <line x1={leftTop.x} y1={oy + profF + 14} x2={leftTop.x} y2={oy + profF + 22}
          stroke="#f97316" strokeWidth={1} />
        <line x1={rightTop.x} y1={oy + profF + 14} x2={rightTop.x} y2={oy + profF + 22}
          stroke="#f97316" strokeWidth={1} />
        <text x={(leftTop.x + rightTop.x) / 2} y={oy + profF + 32}
          textAnchor="middle" fontSize={9} fill="#f97316">
          Vao: {vao.toFixed(2)}m
        </text>

        {/* Pe Direito */}
        <line x1={leftTop.x - 22} y1={leftTop.y} x2={leftTop.x - 22} y2={leftBase.y}
          stroke="#2563eb" strokeWidth={1} />
        <line x1={leftTop.x - 26} y1={leftTop.y} x2={leftTop.x - 18} y2={leftTop.y}
          stroke="#2563eb" strokeWidth={1} />
        <line x1={leftTop.x - 26} y1={leftBase.y} x2={leftTop.x - 18} y2={leftBase.y}
          stroke="#2563eb" strokeWidth={1} />
        <text
          x={leftTop.x - 30} y={(leftTop.y + leftBase.y) / 2}
          textAnchor="middle" fontSize={8} fill="#2563eb"
          transform={`rotate(-90, ${leftTop.x - 30}, ${(leftTop.y + leftBase.y) / 2})`}
        >
          PD: {peDireito.toFixed(2)}m
        </text>

        {/* Fundacao */}
        {profFundacao > 0 && (
          <>
            <line x1={leftBase.x - 14} y1={oy} x2={leftBase.x - 14} y2={oy + profF}
              stroke="#9ca3af" strokeWidth={1} />
            <text x={leftBase.x - 8} y={oy + profF / 2 + 3} fontSize={7} fill="#9ca3af">
              {profFundacao.toFixed(2)}m
            </text>
          </>
        )}

        {/* Inclinacao label */}
        <text x={ridge.x + 6} y={ridge.y - 6} fontSize={8} fill="#7c3aed">
          {inclinacao}%
        </text>

        {/* Legend */}
        <g transform={`translate(${vwW - 110}, 10)`}>
          <rect x={0} y={0} width={100} height={60} fill="white" stroke="#e5e7eb" strokeWidth={1} rx={4} />
          <rect x={6} y={8} width={10} height={6} fill="#f97316" />
          <text x={20} y={15} fontSize={7} fill="#374151">Terca ({tercas.length}x)</text>
          <rect x={6} y={20} width={10} height={10} fill="#dbeafe" stroke="#1e40af" strokeWidth={1} />
          <text x={20} y={28} fontSize={7} fill="#374151">Pilar</text>
          <circle cx={11} cy={38} r={4} fill="#7c3aed" />
          <text x={20} y={41} fontSize={7} fill="#374151">Cumeeira</text>
          <rect x={6} y={47} width={10} height={6} fill="#9ca3af" />
          <text x={20} y={53} fontSize={7} fill="#374151">Fundacao</text>
        </g>

        <text x={20} y={14} fontSize={10} fill="#374151" fontWeight="bold">CORTE TRANSVERSAL</text>
        <text x={20} y={24} fontSize={8} fill="#9ca3af">
          {tipoTelha === 'aluzinco' ? 'Telha Aluzinco' : 'Telha Fibrocimento'} | Incl. {inclinacao}%
        </text>
      </svg>
    </div>
  );
});

export default CrossSectionViewer;
