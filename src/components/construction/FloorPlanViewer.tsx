import React, { memo, useMemo } from 'react';
import { GalpaoVars } from './useGalpaoCalc';

interface Props {
  vars: GalpaoVars;
}

const PILAR_W = 0.25; // metres (drawn)
const PILAR_H = 0.18;

const FloorPlanViewer = memo(function FloorPlanViewer({ vars }: Props) {
  const { vao, comprimento, espacPilares } = vars;

  const ready = vao > 0 && comprimento > 0 && espacPilares > 0;

  const { vwW, vwH, margin, scaleX, scaleY, numX, numY, cotaOffset } = useMemo(() => {
    const margin = 60;
    const cotaOffset = 28;
    const vwW = 520;
    const vwH = 340;
    const drawW = vwW - margin * 2 - cotaOffset;
    const drawH = vwH - margin * 2 - cotaOffset;
    const scaleX = ready ? drawW / comprimento : 1;
    const scaleY = ready ? drawH / vao : 1;
    const numX = ready ? Math.max(2, Math.round(comprimento / espacPilares) + 1) : 0;
    const numY = 2; // two longitudinal lines
    return { vwW, vwH, margin, scaleX, scaleY, numX, numY, cotaOffset };
  }, [vao, comprimento, espacPilares, ready]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <p className="text-sm text-gray-400">Preencha Vao, Comprimento e Espac. Pilares para ver a planta</p>
      </div>
    );
  }

  const ox = margin + cotaOffset;
  const oy = margin + cotaOffset;
  const W = comprimento * scaleX;
  const H = vao * scaleY;

  // Axis positions along X
  const axesX: number[] = [];
  for (let i = 0; i < numX; i++) {
    axesX.push(ox + (i / (numX - 1)) * W);
  }

  // Axes Y: top wall and bottom wall
  const axesY = [oy, oy + H];

  const pilW = Math.max(6, PILAR_W * scaleX);
  const pilH = Math.max(5, PILAR_H * scaleY);

  const espReal = numX > 1 ? comprimento / (numX - 1) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Planta Baixa — Vista Superior</p>
      <svg
        viewBox={`0 0 ${vwW} ${vwH}`}
        width="100%"
        className="font-mono"
        style={{ maxHeight: 320 }}
      >
        {/* Background */}
        <rect width={vwW} height={vwH} fill="#f9fafb" rx={8} />

        {/* Grid lines (axes) */}
        {axesX.map((x, i) => (
          <line key={`ax-${i}`} x1={x} y1={oy} x2={x} y2={oy + H}
            stroke="#d1d5db" strokeWidth={1} strokeDasharray="4 3" />
        ))}
        {axesY.map((y, i) => (
          <line key={`ay-${i}`} x1={ox} y1={y} x2={ox + W} y2={y}
            stroke="#d1d5db" strokeWidth={1} strokeDasharray="4 3" />
        ))}

        {/* Perimeter walls */}
        <rect x={ox} y={oy} width={W} height={H}
          fill="none" stroke="#374151" strokeWidth={2} />

        {/* Pilares */}
        {axesX.map((x, xi) =>
          axesY.map((y, yi) => (
            <rect
              key={`p-${xi}-${yi}`}
              x={x - pilW / 2} y={y - pilH / 2}
              width={pilW} height={pilH}
              fill="#1e40af" stroke="#1e3a8a" strokeWidth={0.5} rx={1}
            />
          ))
        )}

        {/* Column labels along top */}
        {axesX.map((x, i) => (
          <text key={`lx-${i}`} x={x} y={oy - 6}
            textAnchor="middle" fontSize={9} fill="#6b7280">
            {String.fromCharCode(65 + i)}
          </text>
        ))}

        {/* Row labels */}
        {axesY.map((y, i) => (
          <text key={`ly-${i}`} x={ox - 10} y={y + 3}
            textAnchor="middle" fontSize={9} fill="#6b7280">
            {i + 1}
          </text>
        ))}

        {/* ── Cotas ── */}

        {/* Bottom: spacing between columns */}
        {axesX.slice(0, -1).map((x, i) => {
          const x2 = axesX[i + 1];
          const mid = (x + x2) / 2;
          const y = oy + H + 16;
          return (
            <g key={`cota-x-${i}`}>
              <line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke="#f97316" strokeWidth={1} />
              <line x1={x2} y1={y - 3} x2={x2} y2={y + 3} stroke="#f97316" strokeWidth={1} />
              <line x1={x} y1={y} x2={x2} y2={y} stroke="#f97316" strokeWidth={1} />
              <text x={mid} y={y + 10} textAnchor="middle" fontSize={8} fill="#f97316">
                {espReal.toFixed(2)}m
              </text>
            </g>
          );
        })}

        {/* Total comprimento label */}
        <text x={ox + W / 2} y={oy + H + 38} textAnchor="middle" fontSize={9} fill="#374151" fontWeight="bold">
          Comp. total: {comprimento.toFixed(2)}m
        </text>

        {/* Left: vao */}
        <line x1={ox - 18} y1={oy} x2={ox - 18} y2={oy + H} stroke="#f97316" strokeWidth={1} />
        <line x1={ox - 22} y1={oy} x2={ox - 14} y2={oy} stroke="#f97316" strokeWidth={1} />
        <line x1={ox - 22} y1={oy + H} x2={ox - 14} y2={oy + H} stroke="#f97316" strokeWidth={1} />
        <text
          x={ox - 28} y={oy + H / 2}
          textAnchor="middle" fontSize={8} fill="#f97316"
          transform={`rotate(-90, ${ox - 28}, ${oy + H / 2})`}
        >
          Vao: {vao.toFixed(2)}m
        </text>

        {/* North arrow */}
        <g transform={`translate(${vwW - 28}, ${28})`}>
          <circle cx={0} cy={0} r={12} fill="white" stroke="#d1d5db" strokeWidth={1} />
          <polygon points="0,-10 4,4 0,1 -4,4" fill="#1e40af" />
          <text x={0} y={16} textAnchor="middle" fontSize={8} fill="#6b7280">N</text>
        </g>

        {/* Title */}
        <text x={ox} y={14} fontSize={10} fill="#374151" fontWeight="bold">PLANTA BAIXA</text>
        <text x={ox} y={24} fontSize={8} fill="#9ca3af">Pilares: {axesX.length * axesY.length} | Pórticos: {numX}</text>
      </svg>
    </div>
  );
});

export default FloorPlanViewer;
