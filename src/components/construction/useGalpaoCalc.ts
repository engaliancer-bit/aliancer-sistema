import { useMemo } from 'react';

export interface GalpaoVars {
  vao: number;
  comprimento: number;
  peDireito: number;
  espacPilares: number;
  profFundacao: number;
  tamanhoAba: number;
  inclinacao: number;
  tipoTelha: 'aluzinco' | 'fibrocimento';
}

export interface TercaLocacao {
  distanciaAba: number;
  cota: number;
}

export interface GalpaoBOM {
  numPorticos: number;
  numIntermed: number;
  comprimentoInclinado: number;
  tercas: TercaLocacao[];
  numTercas: number;
  numTelhasLargura: number;
  numTelhasComprimento: number;
  totalTelhas: number;
  numCumeeiras: number;
  numPontaletes: number;
  parafusosTercas: number;
}

export function useGalpaoCalc(vars: GalpaoVars): GalpaoBOM {
  return useMemo(() => {
    const { vao, comprimento, peDireito, espacPilares, tamanhoAba, inclinacao, tipoTelha } = vars;

    if (!vao || !comprimento || !espacPilares) {
      return {
        numPorticos: 0, numIntermed: 0, comprimentoInclinado: 0,
        tercas: [], numTercas: 0, numTelhasLargura: 0,
        numTelhasComprimento: 0, totalTelhas: 0, numCumeeiras: 0,
        numPontaletes: 0, parafusosTercas: 0,
      };
    }

    // Number of frames along the building length
    const numPorticos = espacPilares > 0 ? Math.max(2, Math.round(comprimento / espacPilares) + 1) : 2;
    const numIntermed = numPorticos - 2;

    // Inclined rafter length from eave to ridge (one side)
    const slope = inclinacao / 100;
    const comprimentoInclinado = (vao / 2) * Math.sqrt(1 + slope * slope) + tamanhoAba;

    // Purlin (terca) spacing calculation
    const usefulLength = comprimentoInclinado - 0.10 - 0.15;
    let espacTercas: number;
    let numIntervals: number;

    if (tipoTelha === 'aluzinco') {
      // spacing between 1.20 and 1.30 m
      numIntervals = Math.max(1, Math.ceil(usefulLength / 1.25));
      espacTercas = usefulLength / numIntervals;
      if (espacTercas > 1.30) {
        numIntervals++;
        espacTercas = usefulLength / numIntervals;
      }
    } else {
      // fibrocimento: folha length 1.83m minus 0.20m overlap = 1.63m effective
      const folha = 1.63;
      numIntervals = Math.max(1, Math.ceil(usefulLength / folha));
      espacTercas = usefulLength / numIntervals;
    }

    // Build tercas array: first terca at 0.10m from eave, last at comprimentoInclinado - 0.15m
    const tercas: TercaLocacao[] = [];
    tercas.push({ distanciaAba: 0.10, cota: 0.10 });
    for (let i = 1; i <= numIntervals; i++) {
      const cota = 0.10 + i * espacTercas;
      if (cota <= comprimentoInclinado - 0.14) {
        tercas.push({ distanciaAba: cota, cota });
      }
    }
    // Ensure last terca near ridge
    if (tercas[tercas.length - 1].cota < comprimentoInclinado - 0.16) {
      tercas.push({ distanciaAba: comprimentoInclinado - 0.15, cota: comprimentoInclinado - 0.15 });
    }

    // Both sides × number of porticos
    const numTercas = tercas.length * 2 * numPorticos;

    // Telhas
    const larguraTelha = tipoTelha === 'aluzinco' ? 0.90 : 1.10;
    const transpasse = tipoTelha === 'aluzinco' ? 0.10 : 0.20;
    const compTelha = tipoTelha === 'aluzinco' ? comprimentoInclinado : 1.83;

    const numTelhasLargura = Math.ceil((vao / 2 + tamanhoAba) / (larguraTelha - transpasse)) * 2;
    const numTelhasComprimento = tipoTelha === 'aluzinco'
      ? numPorticos - 1
      : Math.ceil((comprimento + 0.20) / (compTelha - transpasse));

    const totalTelhas = numTelhasLargura * numTelhasComprimento;

    // Cumeeiras: 1 per bay for aluzinco, or 1 piece per 2.4m for fibrocimento
    const numCumeeiras = tipoTelha === 'aluzinco'
      ? numPorticos - 1
      : Math.ceil(comprimento / 2.4);

    // Pontaletes (ridge posts): 1 per portico
    const numPontaletes = numPorticos;

    // Parafusos (screws): ~8 per terca/frame connection
    const parafusosTercas = numTercas * 2;

    return {
      numPorticos, numIntermed, comprimentoInclinado,
      tercas, numTercas, numTelhasLargura, numTelhasComprimento,
      totalTelhas, numCumeeiras, numPontaletes, parafusosTercas,
    };
  }, [vars]);
}
