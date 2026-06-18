import { GalpaoVars, GalpaoBOM } from './useGalpaoCalc';
import { Budget } from './types';
import { supabase } from '../../lib/supabase';

interface CompanyInfo {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_cnpj: string;
  logo_url?: string;
}

async function getCompanyInfo(): Promise<CompanyInfo> {
  const { data } = await supabase
    .from('company_settings')
    .select('company_name,company_address,company_phone,company_email,company_cnpj,logo_url')
    .maybeSingle();
  return {
    company_name: data?.company_name || 'Aliancer Engenharia',
    company_address: data?.company_address || '',
    company_phone: data?.company_phone || '',
    company_email: data?.company_email || '',
    company_cnpj: data?.company_cnpj || '',
    logo_url: data?.logo_url,
  };
}

async function loadImgAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawHeader(
  doc: any,
  company: CompanyInfo,
  logoImg: string | null,
  pageTitle: string,
  budget: Budget,
  pageNum: number,
) {
  const pw = doc.internal.pageSize.getWidth();
  // Orange header band
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 0, pw, 28, 'F');

  // Logo
  if (logoImg) {
    try { doc.addImage(logoImg, 'PNG', 8, 3, 22, 22); } catch {}
  }

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(company.company_name, logoImg ? 34 : 12, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text([company.company_address, `${company.company_phone} | ${company.company_email}`].filter(Boolean).join(' · '), logoImg ? 34 : 12, 18);
  doc.text(`CNPJ: ${company.company_cnpj}`, logoImg ? 34 : 12, 23);

  // Page title on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(pageTitle, pw - 10, 10, { align: 'right' });

  // Page number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Pagina ${pageNum}`, pw - 10, 18, { align: 'right' });

  // Project bar
  const client = budget.customers?.name || budget.clientes?.nome_razao_social || '—';
  doc.setFillColor(254, 215, 170);
  doc.rect(0, 28, pw, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(154, 52, 18);
  doc.text(`OBRA: ${budget.title}`, 8, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cliente: ${client}  |  Status: ${budget.status.toUpperCase()}`, pw - 10, 35, { align: 'right' });
}

function drawFooter(doc: any, pageNum: number, totalPages: number) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(243, 244, 246);
  doc.rect(0, ph - 12, pw, 12, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text('Aliancer — Pacote de Producao Confidencial', 8, ph - 5);
  doc.text(`${pageNum} / ${totalPages}`, pw - 10, ph - 5, { align: 'right' });
}

function drawGalpaoSvgAsPdf(doc: any, vars: GalpaoVars, bom: GalpaoBOM, startY: number): number {
  // Draw a simplified floor plan representation with jsPDF primitives
  const pw = doc.internal.pageSize.getWidth();
  const margin = 20;
  const drawW = pw - margin * 2;
  const drawH = 50;
  const scaleX = vars.comprimento > 0 ? drawW / vars.comprimento : 1;
  const scaleY = vars.vao > 0 ? drawH / vars.vao : 1;
  const ox = margin;
  const oy = startY;

  // Perimeter
  doc.setDrawColor(55, 65, 81);
  doc.setLineWidth(0.6);
  doc.rect(ox, oy, vars.comprimento * scaleX, vars.vao * scaleY);

  // Axes
  const numX = bom.numPorticos;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.2);
  for (let i = 0; i < numX; i++) {
    const x = ox + (i / Math.max(1, numX - 1)) * vars.comprimento * scaleX;
    doc.line(x, oy, x, oy + vars.vao * scaleY);
  }

  // Pilares
  doc.setFillColor(30, 64, 175);
  for (let i = 0; i < numX; i++) {
    const x = ox + (i / Math.max(1, numX - 1)) * vars.comprimento * scaleX;
    [oy, oy + vars.vao * scaleY].forEach(y => {
      doc.rect(x - 1.5, y - 1.2, 3, 2.4, 'F');
    });
  }

  // Dimensions
  doc.setTextColor(234, 88, 12);
  doc.setFontSize(7);
  const endX = ox + vars.comprimento * scaleX;
  const endY = oy + vars.vao * scaleY;
  doc.text(`${vars.comprimento.toFixed(2)} m`, ox + vars.comprimento * scaleX / 2, endY + 6, { align: 'center' });
  doc.setTextColor(37, 99, 235);
  doc.text(`${vars.vao.toFixed(2)} m`, ox - 8, oy + vars.vao * scaleY / 2, { angle: 90, align: 'center' });

  return endY + 12;
}

function drawCrossSection(doc: any, vars: GalpaoVars, bom: GalpaoBOM, startY: number): number {
  const pw = doc.internal.pageSize.getWidth();
  const margin = 20;
  const drawW = pw - margin * 2;
  const drawH = 55;
  const halfVao = vars.vao / 2;
  const slope = vars.inclinacao / 100;
  const ridgeH = halfVao * slope;
  const totalH = vars.peDireito + ridgeH;
  const scaleX = drawW / vars.vao;
  const scaleY = drawH / totalH;

  const ox = margin + (vars.vao / 2) * scaleX;
  const oy = startY + drawH + vars.peDireito * scaleY;

  // Columns
  doc.setFillColor(219, 234, 254);
  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.4);
  doc.rect(ox - halfVao * scaleX - 1.5, oy - vars.peDireito * scaleY, 3, vars.peDireito * scaleY, 'FD');
  doc.rect(ox + halfVao * scaleX - 1.5, oy - vars.peDireito * scaleY, 3, vars.peDireito * scaleY, 'FD');

  // Rafters
  doc.setDrawColor(55, 65, 81);
  doc.setLineWidth(0.8);
  doc.line(ox - halfVao * scaleX, oy - vars.peDireito * scaleY, ox, oy - vars.peDireito * scaleY - ridgeH * scaleY);
  doc.line(ox + halfVao * scaleX, oy - vars.peDireito * scaleY, ox, oy - vars.peDireito * scaleY - ridgeH * scaleY);

  // Tercas
  doc.setFillColor(249, 115, 22);
  bom.tercas.forEach(t => {
    const frac = Math.min(1, t.cota / bom.comprimentoInclinado);
    const dx = frac * halfVao * scaleX;
    const dy = frac * ridgeH * scaleY;
    const ly = oy - vars.peDireito * scaleY - dy;
    doc.rect(ox - halfVao * scaleX + dx - 1.5, ly - 1, 3, 2, 'F');
    doc.rect(ox + halfVao * scaleX - dx - 1.5, ly - 1, 3, 2, 'F');
  });

  // Ground
  doc.setDrawColor(107, 114, 128);
  doc.setLineWidth(0.3);
  doc.setLineDash([2, 2]);
  doc.line(margin - 4, oy, margin + drawW + 4, oy);
  doc.setLineDash([]);

  // Dimension labels
  doc.setFontSize(7);
  doc.setTextColor(234, 88, 12);
  doc.text(`Vao: ${vars.vao.toFixed(2)}m`, ox, oy + 7, { align: 'center' });
  doc.setTextColor(37, 99, 235);
  doc.text(`PD: ${vars.peDireito.toFixed(2)}m`, margin - 14, oy - vars.peDireito * scaleY / 2, { angle: 90, align: 'center' });
  doc.setTextColor(124, 58, 237);
  doc.text(`${vars.inclinacao}%`, ox + 4, oy - vars.peDireito * scaleY - ridgeH * scaleY - 3);

  return oy + 14;
}

export async function gerarPacoteProducao(budget: Budget, vars: GalpaoVars, bom: GalpaoBOM) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const company = await getCompanyInfo();
  const logoImg = company.logo_url ? await loadImgAsDataUrl(company.logo_url) : null;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const TOTAL_PAGES = 6;

  // ── PAGE 1: Planta Baixa + resumo ──────────────────────────────────────
  drawHeader(doc, company, logoImg, 'PROJETO EXECUTIVO — GALPAO PRE-MOLDADO', budget, 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text('PLANTA BAIXA — VISTA SUPERIOR', 14, 46);

  let y = 50;
  y = drawGalpaoSvgAsPdf(doc, vars, bom, y);

  // Variables summary table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text('VARIAVEIS DO PROJETO', 14, y + 4);

  autoTable(doc, {
    startY: y + 7,
    head: [['Parametro', 'Valor', 'Parametro', 'Valor']],
    body: [
      ['Vao do Galpao', `${vars.vao.toFixed(2)} m`, 'Comprimento Total', `${vars.comprimento.toFixed(2)} m`],
      ['Pe Direito', `${vars.peDireito.toFixed(2)} m`, 'Espac. entre Pilares', `${vars.espacPilares.toFixed(2)} m`],
      ['Prof. Fundacao', `${vars.profFundacao.toFixed(2)} m`, 'Tamanho da Aba', `${vars.tamanhoAba.toFixed(2)} m`],
      ['Inclinacao Telhado', `${vars.inclinacao}%`, 'Tipo de Telha', vars.tipoTelha === 'aluzinco' ? 'Aluzinco' : 'Fibrocimento'],
    ],
    headStyles: { fillColor: [234, 88, 12], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
    theme: 'striped',
  } as any);

  drawFooter(doc, 1, TOTAL_PAGES);

  // ── PAGE 2: Corte Transversal ──────────────────────────────────────────
  doc.addPage();
  drawHeader(doc, company, logoImg, 'CORTE TRANSVERSAL', budget, 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text('CORTE TRANSVERSAL — PÓRTICO TÍPICO', 14, 46);

  y = 50;
  y = drawCrossSection(doc, vars, bom, y);

  // Calc summary
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  const lines = [
    `Comprimento inclinado da tesoura (sem aba): ${bom.comprimentoInclinado.toFixed(3)} m`,
    `Numero de porticos: ${bom.numPorticos}  |  Porticos intermediarios: ${bom.numIntermed}`,
    `Tercas por lado: ${bom.tercas.length}  |  Total de tercas: ${bom.numTercas} unidades`,
  ];
  lines.forEach((l, i) => { doc.text(l, 14, y + 5 + i * 6); });

  drawFooter(doc, 2, TOTAL_PAGES);

  // ── PAGE 3: OP Tesoura — Gabarito de Locacao das Tercas ───────────────
  doc.addPage();
  drawHeader(doc, company, logoImg, 'OP — TESOURA / TERÇAS', budget, 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text('GABARITO DE LOCAÇÃO DAS TERÇAS', 14, 46);

  autoTable(doc, {
    startY: 50,
    head: [['Terca #', 'Distancia da Aba (m)', 'Cota acumulada (m)', 'Espac. ao proximo (m)']],
    body: bom.tercas.map((t, i) => {
      const next = bom.tercas[i + 1];
      const espac = next ? (next.cota - t.cota).toFixed(3) : '—';
      return [`T-${String(i + 1).padStart(2, '0')}`, t.distanciaAba.toFixed(3), t.cota.toFixed(3), espac];
    }),
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    margin: { left: 14, right: 14 },
    theme: 'striped',
  } as any);

  const afterTable = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text('INFORMACOES TECNICAS DA TESOURA', 14, afterTable);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const info = [
    `Tipo de telha: ${vars.tipoTelha === 'aluzinco' ? 'Aluzinco' : 'Fibrocimento'}`,
    `Inclinacao: ${vars.inclinacao}% (${(Math.atan(vars.inclinacao / 100) * 180 / Math.PI).toFixed(1)} graus)`,
    `Comprimento inclinado total (com aba): ${bom.comprimentoInclinado.toFixed(3)} m`,
    `Aba: ${vars.tamanhoAba.toFixed(2)} m  |  Primeira terca a 0.10m da aba  |  Ultima terca a 0.15m do topo`,
  ];
  info.forEach((l, i) => doc.text(l, 14, afterTable + 6 + i * 5.5));

  // QR Code area placeholder
  doc.setDrawColor(209, 213, 219);
  doc.rect(14, afterTable + 35, 30, 30);
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('QR Code', 29, afterTable + 52, { align: 'center' });
  doc.text('Rastreabilidade', 29, afterTable + 57, { align: 'center' });

  drawFooter(doc, 3, TOTAL_PAGES);

  // ── PAGE 4: Lista de Materiais — BOM ──────────────────────────────────
  doc.addPage();
  drawHeader(doc, company, logoImg, 'LISTA DE MATERIAIS (BOM)', budget, 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text('RESUMO EXECUTIVO — MATERIAIS DE COBERTURA', 14, 46);

  autoTable(doc, {
    startY: 50,
    head: [['Item', 'Descricao', 'Qtd', 'Un']],
    body: [
      ['01', 'Telha ' + (vars.tipoTelha === 'aluzinco' ? 'Aluzinco 0.43mm' : 'Fibrocimento 6mm'), String(bom.totalTelhas), 'un'],
      ['02', 'Terca metalica', String(bom.numTercas), 'un'],
      ['03', 'Cumeeira', String(bom.numCumeeiras), 'un'],
      ['04', 'Pontalete / rincao de cume', String(bom.numPontaletes), 'un'],
      ['05', 'Parafuso auto-brocante (tercas)', String(bom.parafusosTercas), 'un'],
      ['06', 'Parafuso J-bolt (fixacao telha)', String(Math.round(bom.totalTelhas * 2.5)), 'un'],
      ['07', 'Calha de beira', String((bom.numPorticos - 1) * 2), 'un'],
    ],
    headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [236, 253, 245] },
    columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right' } },
    margin: { left: 14, right: 14 },
    theme: 'striped',
  } as any);

  drawFooter(doc, 4, TOTAL_PAGES);

  // ── PAGE 5: OP Pilares ────────────────────────────────────────────────
  doc.addPage();
  drawHeader(doc, company, logoImg, 'OP — PILARES PRE-MOLDADOS', budget, 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text('ORDEM DE PRODUCAO — PILARES', 14, 46);

  const totalPilares = bom.numPorticos * 2;
  autoTable(doc, {
    startY: 50,
    head: [['OP #', 'Elemento', 'Pe Direito', 'Secao', 'Qtd', 'Obs']],
    body: Array.from({ length: bom.numPorticos }, (_, i) => [
      `OP-P${String(i + 1).padStart(2, '0')}`,
      `Pilar Portico ${i + 1}`,
      `${vars.peDireito.toFixed(2)} m`,
      '20x30 cm',
      '2 un',
      i === 0 || i === bom.numPorticos - 1 ? 'Portao / extremidade' : '',
    ]),
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    margin: { left: 14, right: 14 },
    theme: 'striped',
  } as any);

  const pilY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(`Total de pilares: ${totalPilares} unidades  |  Pe direito: ${vars.peDireito.toFixed(2)} m`, 14, pilY);
  doc.text(`Profundidade de fundacao: ${vars.profFundacao.toFixed(2)} m  (confirmar com sondagem local)`, 14, pilY + 5.5);

  // QR placeholder
  doc.setDrawColor(209, 213, 219);
  doc.rect(14, pilY + 12, 30, 30);
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('QR Pilares', 29, pilY + 29, { align: 'center' });

  drawFooter(doc, 5, TOTAL_PAGES);

  // ── PAGE 6: OP Ferragens Diversas ─────────────────────────────────────
  doc.addPage();
  drawHeader(doc, company, logoImg, 'OP — FERRAGENS DIVERSAS', budget, 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text('ORDEM DE PRODUCAO — FERRAGENS DIVERSAS', 14, 46);

  autoTable(doc, {
    startY: 50,
    head: [['Item', 'Descricao', 'Diametro', 'Comprimento', 'Qtd', 'Peso (kg)']],
    body: [
      ['001', 'Estribos colunas 10x10', 'CA-60 4.2mm', '0.46 m', String(totalPilares * Math.ceil(vars.peDireito / 0.15)), '—'],
      ['002', 'Long. pilar principal', 'CA-50 10mm', `${(vars.peDireito + vars.profFundacao + 0.50).toFixed(2)} m`, String(totalPilares * 4), '—'],
      ['003', 'Ferragem de ligacao terco/pilar', 'CA-50 8mm', '0.80 m', String(bom.numPorticos * 4), '—'],
      ['004', 'Chumbador fundacao', 'CA-50 12.5mm', `${(vars.profFundacao + 0.30).toFixed(2)} m`, String(totalPilares * 4), '—'],
    ],
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    margin: { left: 14, right: 14 },
    theme: 'striped',
  } as any);

  const ferY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Nota: quantidades e diametros sujeitos a revisao conforme projeto estrutural assinado pelo responsavel tecnico.', 14, ferY);

  // QR placeholder
  doc.setDrawColor(209, 213, 219);
  doc.rect(14, ferY + 8, 30, 30);
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('QR Ferragens', 29, ferY + 25, { align: 'center' });

  drawFooter(doc, 6, TOTAL_PAGES);

  // Save
  const clientName = (budget.customers?.name || budget.clientes?.nome_razao_social || 'obra').replace(/\s+/g, '_');
  doc.save(`Pacote_Producao_${clientName}_${budget.title.replace(/\s+/g, '_')}.pdf`);
}
