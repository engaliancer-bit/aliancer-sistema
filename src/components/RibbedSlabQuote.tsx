import { useState, useEffect, useRef, useMemo, Component, ReactNode } from 'react';
import { Plus, Edit2, Trash2, Save, X, Calculator, FileText, Download, Scissors, Box, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Importar jsPDF dinamicamente para evitar erros de inicialização
let jsPDF: any = null;
let jsPDFInitialized = false;

const initializeJsPDF = async () => {
  if (jsPDFInitialized) return;

  try {
    const jsPDFModule = await import('jspdf');
    jsPDF = jsPDFModule.default;
    await import('jspdf-autotable');
    jsPDFInitialized = true;
  } catch (error) {
    console.error('Erro ao carregar jsPDF:', error);
    throw error;
  }
};

// Helper para criar instância do jsPDF de forma segura
const createPDF = async () => {
  await initializeJsPDF();

  if (!jsPDF) {
    throw new Error('jsPDF não foi carregado corretamente');
  }

  try {
    return new jsPDF();
  } catch (error) {
    console.error('Erro ao criar instância do jsPDF:', error);
    throw error;
  }
};

class RibbedSlabQuoteErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Erro no componente de laje treliçada:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8">
          <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <h2 className="text-2xl font-bold text-red-900">Erro ao carregar Orçamento de Laje Treliçada</h2>
            </div>
            <p className="text-red-700 mb-4">
              Ocorreu um erro ao tentar carregar este módulo. Por favor, tente recarregar a página.
            </p>
            <details className="bg-white p-4 rounded border border-red-200">
              <summary className="cursor-pointer text-red-800 font-medium">
                Detalhes técnicos do erro
              </summary>
              <pre className="mt-2 text-sm text-gray-700 overflow-auto">
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface Customer {
  id: string;
  name: string;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  cost_per_meter: number | null;
  unit_length_meters: number | null;
}

interface Mold {
  id: string;
  name: string;
  reference_volume_m3: number;
  standard_volume_liters_per_meter: number;
}

interface Recipe {
  id: string;
  name: string;
}

interface RecipeItem {
  id: string;
  recipe_id: string;
  material_id: string;
  quantity: number;
  materials?: {
    id: string;
    name: string;
    unit: string;
  };
}

interface MaterialConsumption {
  material_id: string;
  material_name: string;
  unit: string;
  total_quantity: number;
  unit_price: number;
  total_price: number;
}

interface CuttingPattern {
  pattern: { length: number; count: number }[];
  waste: number;
  efficiency: number;
}

interface CuttingPlan {
  patterns: { pattern: CuttingPattern; quantity: number }[];
  totalTrusses: number;
  totalWaste: number;
  reusableWaste: number;
  averageEfficiency: number;
}

interface RibbedSlabQuote {
  id: string;
  name: string;
  customer_id: string | null;
  total_area: number;
  joist_spacing: number;
  block_side_a: number;
  block_side_b: number;
  block_material_id: string | null;
  block_unit_price: number;
  notes: string;
  labor_cost_percentage?: number;
  fixed_costs_percentage?: number;
  loss_percentage?: number;
  transport_cost?: number;
  profit_margin_percentage?: number;
  status?: 'draft' | 'sent' | 'approved' | 'rejected' | 'in_production';
  production_order_id?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
}

interface RibbedSlabFloor {
  id: string;
  quote_id: string;
  name: string;
  display_order: number;
  area: number;
  notes: string;
  created_at: string;
}

interface RibbedSlabRoom {
  id: string;
  quote_id: string;
  name: string;
  side_a: number;
  side_b: number;
  slab_type: 'H8' | 'H12';
  material_id: string | null;
  material_unit_price: number;
  mold_id: string | null;
  recipe_id: string | null;
  joist_count: number;
  joist_length: number;
  concrete_volume_per_joist: number;
  total_concrete_volume: number;
  needs_reinforcement: boolean;
  reinforcement_material_id: string | null;
  floor: string | null;
  floor_id: string | null;
  created_at: string;
}

interface RibbedSlabQuoteProps {
  highlightQuoteId?: string | null;
  onQuoteOpened?: () => void;
  receivableId?: string | null;
  onBackToSale?: (receivableId: string) => void;
}

function RibbedSlabQuoteInner({ highlightQuoteId, onQuoteOpened, receivableId, onBackToSale }: RibbedSlabQuoteProps = {}) {
  const [quotes, setQuotes] = useState<RibbedSlabQuote[]>([]);
  const [rooms, setRooms] = useState<RibbedSlabRoom[]>([]);
  const [floors, setFloors] = useState<RibbedSlabFloor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const highlightedQuoteRef = useRef<HTMLDivElement>(null);
  const [molds, setMolds] = useState<Mold[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeItems, setRecipeItems] = useState<Record<string, RecipeItem[]>>({});
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const [showBlockCalculation, setShowBlockCalculation] = useState(false);
  const [editingQuote, setEditingQuote] = useState<RibbedSlabQuote | null>(null);
  const [editingRoom, setEditingRoom] = useState<RibbedSlabRoom | null>(null);
  const [showReinforcementModal, setShowReinforcementModal] = useState(false);
  const [pendingRoomData, setPendingRoomData] = useState<any>(null);
  const [reinforcementForm, setReinforcementForm] = useState({
    material_id: ''
  });
  const [pricingForm, setPricingForm] = useState({
    labor_cost_percentage: 0,
    fixed_costs_percentage: 0,
    loss_percentage: 0,
    transport_cost: 0,
    profit_margin_percentage: 0
  });
  const [companySettings, setCompanySettings] = useState<Record<string, string>>({});

  const [trussLength, setTrussLength] = useState<6 | 12>(12);
  const [trussMaterial, setTrussMaterial] = useState<Material | null>(null);

  const [quoteForm, setQuoteForm] = useState({
    name: '',
    customer_id: '',
    total_area: 0,
    joist_spacing: 0.40,
    block_side_a: 0.30,
    block_side_b: 0.12,
    block_material_id: '',
    block_unit_price: 0,
    notes: ''
  });

  const [roomForm, setRoomForm] = useState({
    name: '',
    side_a: 0,
    side_b: 0,
    slab_type: 'H8' as 'H8' | 'H12',
    material_id: '',
    mold_id: '',
    recipe_id: '',
    floor: '',
    floor_id: ''
  });

  const [tempFloors, setTempFloors] = useState<Array<{
    id?: string;
    name: string;
    display_order: number;
    area: number;
    notes: string;
    isNew?: boolean;
  }>>([]);

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        await Promise.all([
          loadQuotes(),
          loadCustomers(),
          loadMaterials(),
          loadMolds(),
          loadRecipes(),
          loadCompanySettings()
        ]);
      } catch (error) {
        console.error('Erro ao inicializar componente de laje treliçada:', error);
      }
    };

    initializeComponent();
  }, []);

  useEffect(() => {
    if (highlightQuoteId && quotes.length > 0) {
      setSelectedQuote(highlightQuoteId);

      const timer = setTimeout(() => {
        if (highlightedQuoteRef.current) {
          highlightedQuoteRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }

        if (onQuoteOpened) {
          onQuoteOpened();
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [highlightQuoteId, quotes, onQuoteOpened]);

  useEffect(() => {
    if (selectedQuote) {
      loadRooms(selectedQuote);
      loadFloors(selectedQuote);
      const quote = quotes.find(q => q.id === selectedQuote);
      if (quote) {
        setPricingForm({
          labor_cost_percentage: quote.labor_cost_percentage || 0,
          fixed_costs_percentage: quote.fixed_costs_percentage || 0,
          loss_percentage: quote.loss_percentage || 0,
          transport_cost: quote.transport_cost || 0,
          profit_margin_percentage: quote.profit_margin_percentage || 0
        });
      }
    }
  }, [selectedQuote, quotes]);

  useEffect(() => {
    const uniqueRecipeIds = [...new Set(rooms.map(room => room.recipe_id).filter(Boolean))];
    uniqueRecipeIds.forEach(recipeId => {
      if (recipeId) {
        loadRecipeItems(recipeId);
      }
    });
  }, [rooms]);

  const selectedQuoteData = useMemo(() => {
    return quotes.find(q => q.id === selectedQuote) || null;
  }, [quotes, selectedQuote]);

  const roomsSummary = useMemo(() => {
    return {
      roomCount: rooms.length,
      totalJoists: rooms.reduce((sum, room) => sum + room.joist_count, 0),
      totalJoistLength: rooms.reduce((sum, room) => sum + (room.joist_count * room.joist_length), 0),
      totalConcreteVolume: rooms.reduce((sum, room) => sum + room.total_concrete_volume, 0)
    };
  }, [rooms]);

  const loadQuotes = async () => {
    const { data, error } = await supabase
      .from('ribbed_slab_quotes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar orçamentos:', error);
      return;
    }
    setQuotes(data || []);
  };

  const loadRooms = async (quoteId: string) => {
    const { data, error } = await supabase
      .from('ribbed_slab_rooms')
      .select('*')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao carregar cômodos:', error);
      return;
    }
    setRooms(data || []);
  };

  const loadFloors = async (quoteId: string) => {
    const { data, error } = await supabase
      .from('ribbed_slab_floors')
      .select('*')
      .eq('quote_id', quoteId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Erro ao carregar pavimentos:', error);
      return;
    }
    setFloors(data || []);
  };

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .order('name');
    setCustomers(data || []);
  };

  const loadMaterials = async () => {
    const { data } = await supabase
      .from('materials')
      .select('id, name, unit, unit_cost, cost_per_meter, unit_length_meters')
      .order('name');
    setMaterials(data || []);

    const truss = data?.find(m =>
      m.name.toLowerCase().includes('treliça') ||
      m.name.toLowerCase().includes('trelica')
    );
    if (truss) {
      setTrussMaterial(truss);
    }
  };

  const loadMolds = async () => {
    const { data } = await supabase
      .from('molds')
      .select('id, name, reference_volume_m3, standard_volume_liters_per_meter')
      .order('name');
    setMolds(data || []);
  };

  const loadRecipes = async () => {
    const { data } = await supabase
      .from('recipes')
      .select('id, name')
      .order('name');
    setRecipes(data || []);
  };

  const loadRecipeItems = async (recipeId: string) => {
    if (recipeItems[recipeId]) {
      return recipeItems[recipeId];
    }

    const { data, error } = await supabase
      .from('recipe_items')
      .select(`
        id,
        recipe_id,
        material_id,
        quantity,
        materials:material_id (
          id,
          name,
          unit
        )
      `)
      .eq('recipe_id', recipeId);

    if (error) {
      console.error('Erro ao carregar itens do traço:', error);
      return [];
    }

    const items = data || [];
    setRecipeItems(prev => ({ ...prev, [recipeId]: items }));
    return items;
  };

  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach((s: any) => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      setCompanySettings(settingsMap);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const calculateTotalMaterialCost = useMemo((): number => {
    try {
      return Array.from(new Set(rooms.map(r => r.material_id))).filter(id => id).reduce((totalSum, materialId) => {
        const material = materials.find(m => m.id === materialId);
        const materialRooms = rooms.filter(r => r.material_id === materialId);
        const totalLength = materialRooms.reduce((sum, room) => sum + (room.joist_count * room.joist_length), 0);
        const costPerMeter = material?.cost_per_meter || material?.unit_cost || 0;
        return totalSum + (totalLength * costPerMeter);
      }, 0);
    } catch (error) {
      console.error('Erro ao calcular custo total de materiais:', error);
      return 0;
    }
  }, [rooms, materials]);

  const calculateRecipeMaterialsCost = useMemo((): number => {
    try {
      const consumption = calculateMaterialConsumption(rooms);
      return consumption.reduce((sum, item) => sum + item.total_price, 0);
    } catch (error) {
      console.error('Erro ao calcular custo de materiais do traço:', error);
      return 0;
    }
  }, [rooms]);

  const calculateTrussWasteCost = useMemo((): number => {
    try {
      if (!trussMaterial || rooms.length === 0) return 0;

      const cuttingPlan = optimizeCutting(trussLength);
      const totalWasteMeters = cuttingPlan.totalWaste;

      const costPerMeter = trussMaterial.cost_per_meter || trussMaterial.unit_cost;
      return totalWasteMeters * costPerMeter;
    } catch (error) {
      console.error('Erro ao calcular custo de desperdício de treliça:', error);
      return 0;
    }
  }, [trussMaterial, rooms, trussLength]);

  const calculateReinforcementCost = useMemo((): number => {
    try {
      const roomsWithReinforcement = rooms.filter(r => r.needs_reinforcement && r.reinforcement_material_id);

      if (roomsWithReinforcement.length === 0) return 0;

      let totalCost = 0;

      roomsWithReinforcement.forEach(room => {
        const reinforcementMaterial = materials.find(m => m.id === room.reinforcement_material_id);

        if (reinforcementMaterial) {
          const totalLength = room.joist_count * room.joist_length;

          if (reinforcementMaterial.unit_length_meters && reinforcementMaterial.unit_length_meters > 0) {
            const quantity = totalLength / reinforcementMaterial.unit_length_meters;
            totalCost += quantity * reinforcementMaterial.unit_cost;
          } else {
            const costPerMeter = reinforcementMaterial.cost_per_meter || reinforcementMaterial.unit_cost;
            totalCost += totalLength * costPerMeter;
          }
        }
      });

      return totalCost;
    } catch (error) {
      console.error('Erro ao calcular custo de reforço:', error);
      return 0;
    }
  }, [rooms, materials]);

  const calculateBlocksCost = useMemo((): number => {
    try {
      if (!selectedQuoteData || selectedQuoteData.block_unit_price === 0) return 0;
      const blockCalc = calculateTotalBlocks();
      return blockCalc.totalBlocks * selectedQuoteData.block_unit_price;
    } catch (error) {
      console.error('Erro ao calcular custo de blocos:', error);
      return 0;
    }
  }, [selectedQuoteData]);

  const calculateCombinedMaterialCost = useMemo((): number => {
    try {
      return calculateTotalMaterialCost + calculateRecipeMaterialsCost + calculateTrussWasteCost + calculateReinforcementCost;
    } catch (error) {
      console.error('Erro ao calcular custo combinado de materiais:', error);
      return 0;
    }
  }, [calculateTotalMaterialCost, calculateRecipeMaterialsCost, calculateTrussWasteCost, calculateReinforcementCost]);

  const calculateBlocksPerRoom = (room: RibbedSlabRoom, quote: RibbedSlabQuote) => {
    const blockSideA = quote.block_side_a;
    const blockSideB = quote.block_side_b;
    const joistSpacing = quote.joist_spacing;
    const roomArea = room.side_a * room.side_b;
    const largerSide = Math.max(room.side_a, room.side_b);

    const divisionResult = largerSide / joistSpacing;
    const decimalPart = divisionResult - Math.floor(divisionResult);

    let numberOfGaps = Math.floor(divisionResult);
    if (decimalPart > 0 && (decimalPart < 0.10 || decimalPart > 0.12)) {
      numberOfGaps = numberOfGaps + 1;
    }

    const smallerBlockSide = Math.min(blockSideA, blockSideB);
    const blocksPerMeter = 1 / smallerBlockSide;

    const gapLength = room.joist_length - 0.10;
    const blocksByGapMethod = Math.ceil(gapLength * blocksPerMeter * numberOfGaps);

    const blocksPerM2 = 1 / (blockSideA * blockSideB);
    const blocksByAreaMethod = Math.ceil(roomArea * blocksPerM2);

    const baseQuantity = blocksByGapMethod;
    const quantityWithWaste = baseQuantity * 1.1;

    return {
      roomName: room.name,
      roomArea,
      blockSideA,
      blockSideB,
      smallerBlockSide,
      blocksPerMeter: blocksPerMeter.toFixed(2),
      gapLength: gapLength.toFixed(2),
      numberOfGaps,
      decimalPart: decimalPart.toFixed(3),
      blocksByGapMethod,
      blocksByAreaMethod,
      baseQuantity,
      wasteQuantity: Math.ceil(quantityWithWaste - baseQuantity),
      finalQuantity: Math.ceil(quantityWithWaste)
    };
  };

  const blockCalcMemo = useMemo(() => {
    if (!selectedQuoteData) return { roomCalculations: [], totalBlocks: 0 };
    const roomCalculations = rooms.map(room => calculateBlocksPerRoom(room, selectedQuoteData));
    const totalBlocks = roomCalculations.reduce((sum, calc) => sum + calc.finalQuantity, 0);
    return {
      roomCalculations,
      totalBlocks
    };
  }, [rooms, selectedQuoteData]);

  const calculateTotalBlocks = () => blockCalcMemo;

  const optimizeCutting = (trussLengthM: number): CuttingPlan => {
    const joistRequirements: { [key: number]: number } = {};

    rooms.forEach(room => {
      const length = room.joist_length;
      joistRequirements[length] = (joistRequirements[length] || 0) + room.joist_count;
    });

    const lengths = Object.keys(joistRequirements).map(Number).sort((a, b) => b - a);
    const remaining = { ...joistRequirements };
    const usedPatterns: { pattern: CuttingPattern; quantity: number }[] = [];

    const generatePatterns = (maxLength: number): CuttingPattern[] => {
      const patterns: CuttingPattern[] = [];

      const tryPattern = (current: number[], index: number) => {
        if (index >= lengths.length) {
          if (current.some(c => c > 0)) {
            const used = current.reduce((sum, count, i) => sum + count * lengths[i], 0);
            const waste = maxLength - used;

            if (waste >= 0) {
              const patternObj: CuttingPattern = {
                pattern: current.map((count, i) => ({ length: lengths[i], count })).filter(p => p.count > 0),
                waste,
                efficiency: (used / maxLength) * 100
              };
              patterns.push(patternObj);
            }
          }
          return;
        }

        const maxCount = Math.floor(maxLength / lengths[index]);
        for (let count = maxCount; count >= 0; count--) {
          const newCurrent = [...current];
          newCurrent[index] = count;
          const used = newCurrent.reduce((sum, c, i) => sum + c * lengths[i], 0);
          if (used <= maxLength) {
            tryPattern(newCurrent, index + 1);
          }
        }
      };

      tryPattern(new Array(lengths.length).fill(0), 0);
      return patterns.sort((a, b) => b.efficiency - a.efficiency);
    };

    const allPatterns = generatePatterns(trussLengthM);

    while (Object.values(remaining).some(v => v > 0)) {
      let bestPattern: CuttingPattern | null = null;
      let bestScore = -1;

      for (const pattern of allPatterns) {
        let canUse = true;
        let score = 0;

        for (const item of pattern.pattern) {
          const needed = remaining[item.length] || 0;
          if (needed === 0) continue;

          const canFit = Math.min(item.count, needed);
          if (canFit === 0) {
            canUse = false;
            break;
          }
          score += canFit * item.length;
        }

        if (canUse && score > bestScore) {
          bestScore = score;
          bestPattern = pattern;
        }
      }

      if (!bestPattern) break;

      for (const item of bestPattern.pattern) {
        const needed = remaining[item.length] || 0;
        const used = Math.min(item.count, needed);
        remaining[item.length] = needed - used;
      }

      const existingIndex = usedPatterns.findIndex(
        up => JSON.stringify(up.pattern.pattern) === JSON.stringify(bestPattern!.pattern)
      );

      if (existingIndex >= 0) {
        usedPatterns[existingIndex].quantity++;
      } else {
        usedPatterns.push({ pattern: bestPattern, quantity: 1 });
      }
    }

    const totalTrusses = usedPatterns.reduce((sum, up) => sum + up.quantity, 0);

    const totalWaste = usedPatterns.reduce((sum, up) => {
      if (up.pattern.waste <= 0.90) {
        return sum + (up.pattern.waste * up.quantity);
      }
      return sum;
    }, 0);

    const reusableWaste = usedPatterns.reduce((sum, up) => {
      if (up.pattern.waste > 0.90) {
        return sum + (up.pattern.waste * up.quantity);
      }
      return sum;
    }, 0);

    const averageEfficiency = totalTrusses > 0
      ? usedPatterns.reduce((sum, up) => sum + (up.pattern.efficiency * up.quantity), 0) / totalTrusses
      : 0;

    return {
      patterns: usedPatterns,
      totalTrusses,
      totalWaste,
      reusableWaste,
      averageEfficiency
    };
  };

  const calculateMaterialConsumption = (selectedRooms: RibbedSlabRoom[]): MaterialConsumption[] => {
    const consumptionMap = new Map<string, MaterialConsumption>();

    selectedRooms.forEach(room => {
      if (!room.recipe_id) return;

      const items = recipeItems[room.recipe_id] || [];
      const volumeM3 = room.total_concrete_volume;

      items.forEach(item => {
        if (!item.materials) return;

        const material = materials.find(m => m.id === item.material_id);
        const unitPrice = material?.unit_cost || 0;
        const totalQuantity = item.quantity * volumeM3;
        const totalPrice = totalQuantity * unitPrice;
        const key = item.material_id;

        if (consumptionMap.has(key)) {
          const existing = consumptionMap.get(key)!;
          existing.total_quantity += totalQuantity;
          existing.total_price += totalPrice;
        } else {
          consumptionMap.set(key, {
            material_id: item.material_id,
            material_name: item.materials.name,
            unit: item.materials.unit,
            total_quantity: totalQuantity,
            unit_price: unitPrice,
            total_price: totalPrice
          });
        }
      });
    });

    return Array.from(consumptionMap.values());
  };

  const calculateJoistParameters = (
    sideA: number,
    sideB: number,
    joistSpacing: number,
    concreteVolumePerMold: number
  ) => {
    const minorSide = Math.min(sideA, sideB);
    const majorSide = Math.max(sideA, sideB);

    const joistLength = minorSide + 0.10;

    let joistCount = majorSide / joistSpacing;
    const decimalPart = joistCount - Math.floor(joistCount);

    if (decimalPart >= 0.10 && decimalPart <= 0.12) {
      joistCount = Math.floor(joistCount) + 1;
    } else {
      joistCount = Math.floor(joistCount);
    }

    const concreteVolumePerJoist = concreteVolumePerMold;
    const totalConcreteVolume = concreteVolumePerJoist * joistCount;

    return {
      joistLength: parseFloat(joistLength.toFixed(2)),
      joistCount,
      concreteVolumePerJoist: parseFloat(concreteVolumePerJoist.toFixed(4)),
      totalConcreteVolume: parseFloat(totalConcreteVolume.toFixed(4))
    };
  };

  const handleSaveQuote = async () => {
    if (!quoteForm.name.trim()) {
      alert('Por favor, preencha o nome do projeto');
      return;
    }

    if (tempFloors.length === 0) {
      alert('Por favor, adicione pelo menos um pavimento');
      return;
    }

    if (tempFloors.some(f => !f.name.trim() || f.area <= 0)) {
      alert('Por favor, preencha o nome e área de todos os pavimentos');
      return;
    }

    const totalArea = tempFloors.reduce((sum, f) => sum + f.area, 0);

    const quoteData = {
      name: quoteForm.name,
      customer_id: quoteForm.customer_id || null,
      total_area: totalArea,
      joist_spacing: quoteForm.joist_spacing,
      block_side_a: quoteForm.block_side_a,
      block_side_b: quoteForm.block_side_b,
      block_material_id: quoteForm.block_material_id || null,
      block_unit_price: quoteForm.block_unit_price,
      notes: quoteForm.notes,
      updated_at: new Date().toISOString()
    };

    let quoteId: string;

    if (editingQuote) {
      const { error } = await supabase
        .from('ribbed_slab_quotes')
        .update(quoteData)
        .eq('id', editingQuote.id);

      if (error) {
        console.error('Erro ao atualizar orçamento:', error);
        alert('Erro ao atualizar orçamento');
        return;
      }
      quoteId = editingQuote.id;

      await supabase
        .from('ribbed_slab_floors')
        .delete()
        .eq('quote_id', quoteId);
    } else {
      const { data, error } = await supabase
        .from('ribbed_slab_quotes')
        .insert([quoteData])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar orçamento:', error);
        alert('Erro ao criar orçamento');
        return;
      }

      if (data) {
        quoteId = data.id;
        setSelectedQuote(data.id);
      } else {
        return;
      }
    }

    const floorsToInsert = tempFloors.map(floor => ({
      quote_id: quoteId,
      name: floor.name,
      display_order: floor.display_order,
      area: floor.area,
      notes: floor.notes || ''
    }));

    const { error: floorsError } = await supabase
      .from('ribbed_slab_floors')
      .insert(floorsToInsert);

    if (floorsError) {
      console.error('Erro ao salvar pavimentos:', floorsError);
      alert('Erro ao salvar pavimentos');
      return;
    }

    loadQuotes();
    if (quoteId) {
      loadFloors(quoteId);
    }
    handleCancelQuote();
  };

  const handleSaveRoom = async () => {
    if (!selectedQuote) {
      alert('Selecione um projeto primeiro');
      return;
    }

    if (!roomForm.name.trim() || !roomForm.side_a || !roomForm.side_b) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const selectedMold = molds.find(m => m.id === roomForm.mold_id);
    const selectedMaterial = materials.find(m => m.id === roomForm.material_id);

    if (!selectedMold || !selectedQuoteData) {
      alert('Por favor, selecione uma fôrma válida');
      return;
    }

    const calculations = calculateJoistParameters(
      roomForm.side_a,
      roomForm.side_b,
      selectedQuoteData.joist_spacing,
      selectedMold.reference_volume_m3
    );

    const selectedFloor = floors.find(f => f.id === roomForm.floor_id);

    const roomData = {
      quote_id: selectedQuote,
      name: roomForm.name,
      side_a: roomForm.side_a,
      side_b: roomForm.side_b,
      slab_type: roomForm.slab_type,
      material_id: roomForm.material_id || null,
      material_unit_price: selectedMaterial?.cost_per_meter || selectedMaterial?.unit_cost || 0,
      mold_id: roomForm.mold_id || null,
      recipe_id: roomForm.recipe_id || null,
      joist_count: calculations.joistCount,
      joist_length: calculations.joistLength,
      concrete_volume_per_joist: calculations.concreteVolumePerJoist,
      total_concrete_volume: calculations.totalConcreteVolume,
      needs_reinforcement: false,
      reinforcement_material_id: null,
      floor: selectedFloor?.name || roomForm.floor || null,
      floor_id: roomForm.floor_id || null
    };

    if (calculations.joistLength > 3.01) {
      setPendingRoomData(roomData);
      setShowReinforcementModal(true);
      return;
    }

    await saveRoomData(roomData);
  };

  const saveRoomData = async (roomData: any) => {
    if (editingRoom) {
      const { error } = await supabase
        .from('ribbed_slab_rooms')
        .update(roomData)
        .eq('id', editingRoom.id);

      if (error) {
        console.error('Erro ao atualizar cômodo:', error);
        alert('Erro ao atualizar cômodo');
        return;
      }
    } else {
      const { error } = await supabase
        .from('ribbed_slab_rooms')
        .insert([roomData]);

      if (error) {
        console.error('Erro ao criar cômodo:', error);
        alert('Erro ao criar cômodo');
        return;
      }
    }

    loadRooms(selectedQuote!);
    handleCancelRoom();
  };

  const handleConfirmReinforcement = async () => {
    if (!reinforcementForm.material_id) {
      alert('Por favor, selecione o material do reforço');
      return;
    }

    const roomDataWithReinforcement = {
      ...pendingRoomData,
      needs_reinforcement: true,
      reinforcement_material_id: reinforcementForm.material_id
    };

    await saveRoomData(roomDataWithReinforcement);
    setShowReinforcementModal(false);
    setPendingRoomData(null);
    setReinforcementForm({ material_id: '' });
  };

  const handleSkipReinforcement = async () => {
    await saveRoomData(pendingRoomData);
    setShowReinforcementModal(false);
    setPendingRoomData(null);
    setReinforcementForm({ material_id: '', diameter: '' });
  };

  const handleEditQuote = async (quote: RibbedSlabQuote) => {
    setEditingQuote(quote);
    setQuoteForm({
      name: quote.name,
      customer_id: quote.customer_id || '',
      total_area: quote.total_area,
      joist_spacing: quote.joist_spacing,
      block_side_a: quote.block_side_a,
      block_side_b: quote.block_side_b,
      block_material_id: quote.block_material_id || '',
      block_unit_price: quote.block_unit_price || 0,
      notes: quote.notes || ''
    });

    const { data: quoteFloors } = await supabase
      .from('ribbed_slab_floors')
      .select('*')
      .eq('quote_id', quote.id)
      .order('display_order');

    if (quoteFloors && quoteFloors.length > 0) {
      setTempFloors(quoteFloors.map(f => ({
        id: f.id,
        name: f.name,
        display_order: f.display_order,
        area: f.area,
        notes: f.notes || '',
        isNew: false
      })));
    } else {
      setTempFloors([]);
    }

    setShowQuoteForm(true);
  };

  const handleEditRoom = (room: RibbedSlabRoom) => {
    setEditingRoom(room);
    setRoomForm({
      name: room.name,
      side_a: room.side_a,
      side_b: room.side_b,
      slab_type: room.slab_type,
      material_id: room.material_id || '',
      mold_id: room.mold_id || '',
      recipe_id: room.recipe_id || '',
      floor: room.floor || '',
      floor_id: room.floor_id || ''
    });
    setShowRoomForm(true);
  };

  const handleDeleteQuote = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento? Todos os cômodos serão excluídos também.')) {
      return;
    }

    const { error } = await supabase
      .from('ribbed_slab_quotes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir orçamento:', error);
      alert('Erro ao excluir orçamento');
      return;
    }

    if (selectedQuote === id) {
      setSelectedQuote(null);
      setRooms([]);
    }
    loadQuotes();
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cômodo?')) {
      return;
    }

    const { error } = await supabase
      .from('ribbed_slab_rooms')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir cômodo:', error);
      alert('Erro ao excluir cômodo');
      return;
    }

    if (selectedQuote) {
      loadRooms(selectedQuote);
    }
  };

  const handleChangeStatus = async (newStatus: 'draft' | 'sent' | 'approved' | 'rejected' | 'in_production') => {
    if (!selectedQuote || !selectedQuoteData) {
      alert('Selecione um orçamento primeiro');
      return;
    }

    const updateData: any = { status: newStatus };

    if (newStatus === 'approved') {
      const materialCost = calculateCombinedMaterialCost;
      const blocksCost = calculateBlocksCost;
      const laborCost = materialCost * (selectedQuoteData.labor_cost_percentage || 0) / 100;
      const fixedCosts = materialCost * (selectedQuoteData.fixed_costs_percentage || 0) / 100;
      const lossCost = materialCost * (selectedQuoteData.loss_percentage || 0) / 100;
      const totalCost = materialCost + laborCost + fixedCosts + lossCost + (selectedQuoteData.transport_cost || 0);
      const profit = totalCost * (selectedQuoteData.profit_margin_percentage || 0) / 100;
      const totalValue = totalCost + profit + blocksCost;

      updateData.total_value = totalValue;
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = 'Sistema';
      updateData.approval_status = 'aprovado';
    }

    const { error } = await supabase
      .from('ribbed_slab_quotes')
      .update(updateData)
      .eq('id', selectedQuote);

    if (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do orçamento');
      return;
    }

    loadQuotes();
    if (selectedQuote) {
      loadRooms(selectedQuote);
    }
  };

  const handleApproveQuote = async () => {
    if (!selectedQuote || !selectedQuoteData) {
      alert('Selecione um orçamento primeiro');
      return;
    }

    if (selectedQuoteData.production_order_id) {
      alert('Este orçamento já possui uma ordem de produção vinculada');
      return;
    }

    if (!confirm('Deseja aprovar este orçamento e gerar a ordem de produção automaticamente?')) {
      return;
    }

    try {
      // Calcular materiais necessários
      const materialsNeeded = calculateMaterialsForProduction();

      // Verificar estoque
      const stockCheck = await checkStockAvailability(materialsNeeded);

      // Se houver falta de estoque, mostrar alerta
      if (stockCheck.hasShortage) {
        const shortageMessage = stockCheck.shortages.map(s =>
          `${s.material_name}: Necessário ${s.needed.toFixed(2)} ${s.unit}, Disponível ${s.available.toFixed(2)} ${s.unit}`
        ).join('\n');

        if (!confirm(`ATENÇÃO: Falta de estoque detectada!\n\n${shortageMessage}\n\nDeseja continuar mesmo assim?`)) {
          return;
        }
      }

      // Gerar relatórios de corte
      const cuttingReportBlob = await generateCuttingReportBlob();

      // Gerar número de ordem sequencial
      const { data: lastOrder } = await supabase
        .from('production_orders')
        .select('order_number')
        .order('order_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newOrderNumber = (lastOrder?.order_number || 0) + 1;

      // Criar descrição detalhada dos cômodos
      const roomsDescription = rooms.map(room =>
        `- ${room.name}: ${room.joist_count} vigotas de ${room.joist_length}m (${room.slab_type})`
      ).join('\n');

      // Calcular quantidade total de vigotas
      const totalJoists = rooms.reduce((sum, room) => sum + room.joist_count, 0);

      // Criar ordem de produção
      const productionOrderData = {
        customer_id: selectedQuoteData.customer_id,
        product_id: null,
        order_number: newOrderNumber,
        total_quantity: totalJoists,
        produced_quantity: 0,
        remaining_quantity: totalJoists,
        status: 'open',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `Gerado automaticamente do orçamento: ${selectedQuoteData.name}\n\nDetalhamento:\n${roomsDescription}`
      };

      const { data: productionOrder, error: orderError } = await supabase
        .from('production_orders')
        .insert([productionOrderData])
        .select()
        .single();

      if (orderError) throw orderError;

      // Fazer upload do relatório de corte
      if (cuttingReportBlob) {
        const fileName = `relatorio-corte-${productionOrder.order_number}-${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(`production-orders/${fileName}`, cuttingReportBlob);

        if (!uploadError) {
          // Salvar referência do anexo
          await supabase
            .from('attachments')
            .insert([{
              entity_type: 'production_order',
              entity_id: productionOrder.id,
              file_name: fileName,
              file_path: `production-orders/${fileName}`,
              file_size: cuttingReportBlob.size,
              mime_type: 'application/pdf'
            }]);
        }
      }

      // Gerar alertas de estoque se necessário
      if (stockCheck.hasShortage) {
        for (const shortage of stockCheck.shortages) {
          await supabase
            .from('stock_alerts')
            .insert([{
              material_id: shortage.material_id,
              alert_type: 'low_stock',
              message: `Estoque insuficiente para ordem ${productionOrder.order_number}. Necessário: ${shortage.needed.toFixed(2)} ${shortage.unit}`,
              production_order_id: productionOrder.id
            }]);
        }
      }

      // Calcular valor total do orçamento para salvar no banco
      const materialCost = calculateCombinedMaterialCost;
      const blocksCost = calculateBlocksCost;
      const laborCost = materialCost * (selectedQuoteData.labor_cost_percentage || 0) / 100;
      const fixedCosts = materialCost * (selectedQuoteData.fixed_costs_percentage || 0) / 100;
      const lossCost = materialCost * (selectedQuoteData.loss_percentage || 0) / 100;
      const totalCost = materialCost + laborCost + fixedCosts + lossCost + (selectedQuoteData.transport_cost || 0);
      const profit = totalCost * (selectedQuoteData.profit_margin_percentage || 0) / 100;
      const totalValue = totalCost + profit + blocksCost;

      // Atualizar orçamento com status aprovado e vincular ordem de produção
      const { error: updateError } = await supabase
        .from('ribbed_slab_quotes')
        .update({
          status: 'approved',
          production_order_id: productionOrder.id,
          approved_at: new Date().toISOString(),
          approved_by: 'Sistema',
          total_value: totalValue
        })
        .eq('id', selectedQuote);

      if (updateError) throw updateError;

      alert(`Orçamento aprovado com sucesso!\nOrdem de Produção ${productionOrder.order_number} criada.${stockCheck.hasShortage ? '\n\nALERTA: Verifique os alertas de estoque!' : ''}`);

      // Recarregar dados do orçamento para manter na mesma aba
      await loadQuotes();
      if (selectedQuote) {
        const { data: updatedQuote } = await supabase
          .from('ribbed_slab_quotes')
          .select('*')
          .eq('id', selectedQuote)
          .single();

        if (updatedQuote) {
          setSelectedQuoteData(updatedQuote);
        }
        await loadRooms(selectedQuote);
      }

    } catch (error) {
      console.error('Erro ao aprovar orçamento:', error);
      alert('Erro ao aprovar orçamento e gerar ordem de produção');
    }
  };

  const calculateMaterialsForProduction = () => {
    const materialsMap: { [key: string]: { material_id: string; material_name: string; unit: string; quantity: number } } = {};

    rooms.forEach(room => {
      // Material da vigota
      if (room.material_id) {
        const key = room.material_id;
        if (!materialsMap[key]) {
          const material = materials.find(m => m.id === room.material_id);
          materialsMap[key] = {
            material_id: room.material_id,
            material_name: material?.name || 'Material',
            unit: 'm',
            quantity: 0
          };
        }
        materialsMap[key].quantity += room.joist_count * room.joist_length;
      }

      // Materiais do traço (receita)
      if (room.recipe_id && room.mold_id) {
        const mold = molds.find(m => m.id === room.mold_id);
        if (mold) {
          const volumePerMeter = mold.standard_volume_liters_per_meter / 1000;
          const totalVolume = room.joist_count * room.joist_length * volumePerMeter;

          const roomRecipeItems = recipeItems[room.recipe_id] || [];
          roomRecipeItems.forEach(item => {
            const key = item.material_id;
            if (!materialsMap[key]) {
              materialsMap[key] = {
                material_id: item.material_id,
                material_name: item.materials?.name || 'Material',
                unit: item.materials?.unit || 'kg',
                quantity: 0
              };
            }
            materialsMap[key].quantity += item.quantity * totalVolume;
          });
        }
      }

      // Material da tavela (bloco)
      if (selectedQuoteData?.block_material_id && selectedQuoteData.block_side_a > 0 && selectedQuoteData.block_side_b > 0) {
        const key = selectedQuoteData.block_material_id;
        if (!materialsMap[key]) {
          const material = materials.find(m => m.id === selectedQuoteData.block_material_id);
          materialsMap[key] = {
            material_id: selectedQuoteData.block_material_id,
            material_name: material?.name || 'Tavela',
            unit: material?.unit || 'unidade',
            quantity: 0
          };
        }

        // Calcular quantidade de tavelas para este cômodo
        const roomArea = room.side_a * room.side_b;
        const blockArea = selectedQuoteData.block_side_a * selectedQuoteData.block_side_b;
        const blocksNeeded = Math.ceil(roomArea / blockArea);

        materialsMap[key].quantity += blocksNeeded;
      }

      // Material de reforço
      if (room.needs_reinforcement && room.reinforcement_material_id) {
        const key = room.reinforcement_material_id;
        const reinforcementMaterial = materials.find(m => m.id === room.reinforcement_material_id);

        if (reinforcementMaterial) {
          if (!materialsMap[key]) {
            materialsMap[key] = {
              material_id: room.reinforcement_material_id,
              material_name: reinforcementMaterial.name,
              unit: reinforcementMaterial.unit || 'unidade',
              quantity: 0
            };
          }

          const totalLength = room.joist_count * room.joist_length;

          // Se o material tem comprimento unitário (ex: treliça de 6m), calcular quantidade de unidades
          if (reinforcementMaterial.unit_length_meters && reinforcementMaterial.unit_length_meters > 0) {
            const quantity = totalLength / reinforcementMaterial.unit_length_meters;
            materialsMap[key].quantity += quantity;
          } else {
            // Se não tem comprimento unitário, usar metros
            materialsMap[key].quantity += totalLength;
          }
        }
      }
    });

    return Object.values(materialsMap);
  };

  const checkStockAvailability = async (materialsNeeded: any[]) => {
    const shortages = [];

    for (const material of materialsNeeded) {
      const { data: inventoryData } = await supabase
        .from('material_inventory')
        .select('current_stock')
        .eq('material_id', material.material_id)
        .maybeSingle();

      const available = inventoryData?.current_stock || 0;

      if (available < material.quantity) {
        shortages.push({
          material_id: material.material_id,
          material_name: material.material_name,
          unit: material.unit,
          needed: material.quantity,
          available: available
        });
      }
    }

    return {
      hasShortage: shortages.length > 0,
      shortages
    };
  };

  const generateCuttingReportBlob = async (): Promise<Blob | null> => {
    if (!selectedQuoteData || rooms.length === 0) return null;

    try {
      const doc = await createPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 15;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE CORTE - PRODUÇÃO', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Projeto: ${selectedQuoteData.name}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Cliente: ${getCustomerName(selectedQuoteData.customer_id)}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, yPosition);
      yPosition += 10;

      // Calcular otimização de corte
      const cuttingData = [];

      for (const room of rooms) {
        const optimization = optimizeCutting(room.joist_length);

        cuttingData.push([
          room.name,
          `${room.joist_count} un`,
          `${room.joist_length.toFixed(2)}m`,
          room.slab_type,
          `${optimization.totalBars} barras`,
          `${optimization.totalWaste.toFixed(2)}m (${optimization.efficiency.toFixed(1)}%)`
        ]);
      }

      (doc as any).autoTable({
        startY: yPosition,
        head: [['Cômodo', 'Qtd Vigotas', 'Comprimento', 'Tipo', 'Barras 12m', 'Perda Total']],
        body: cuttingData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 30 },
          3: { cellWidth: 20 },
          4: { cellWidth: 30 },
          5: { cellWidth: 45 }
        }
      });

      return doc.output('blob');
    } catch (error) {
      console.error('Erro ao gerar relatório de corte:', error);
      return null;
    }
  };

  const handleSavePricing = async () => {
    if (!selectedQuote) {
      alert('Selecione um orçamento primeiro');
      return;
    }

    const materialCost = calculateCombinedMaterialCost;
    const blocksCost = calculateBlocksCost;
    const laborCost = materialCost * pricingForm.labor_cost_percentage / 100;
    const fixedCosts = materialCost * pricingForm.fixed_costs_percentage / 100;
    const lossCost = materialCost * pricingForm.loss_percentage / 100;
    const totalCost = materialCost + laborCost + fixedCosts + lossCost + pricingForm.transport_cost;
    const profit = totalCost * pricingForm.profit_margin_percentage / 100;
    const totalValue = totalCost + profit + blocksCost;

    const { error } = await supabase
      .from('ribbed_slab_quotes')
      .update({
        labor_cost_percentage: pricingForm.labor_cost_percentage,
        fixed_costs_percentage: pricingForm.fixed_costs_percentage,
        loss_percentage: pricingForm.loss_percentage,
        transport_cost: pricingForm.transport_cost,
        profit_margin_percentage: pricingForm.profit_margin_percentage,
        total_value: totalValue
      })
      .eq('id', selectedQuote);

    if (error) {
      console.error('Erro ao salvar precificação:', error);
      alert('Erro ao salvar precificação');
      return;
    }

    alert('Precificação salva com sucesso!');
    loadQuotes();
  };

  const handleCancelQuote = () => {
    setShowQuoteForm(false);
    setEditingQuote(null);
    setTempFloors([]);
    setQuoteForm({
      name: '',
      customer_id: '',
      total_area: 0,
      joist_spacing: 0.40,
      block_side_a: 0.30,
      block_side_b: 0.12,
      block_material_id: '',
      block_unit_price: 0,
      notes: ''
    });
  };

  const handleCancelRoom = () => {
    setShowRoomForm(false);
    setEditingRoom(null);
    setRoomForm({
      name: '',
      side_a: 0,
      side_b: 0,
      slab_type: 'H8',
      material_id: '',
      mold_id: '',
      recipe_id: '',
      floor: '',
      floor_id: ''
    });
  };

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return '-';
    return customers.find(c => c.id === customerId)?.name || '-';
  };

  const getMaterialName = (materialId: string | null) => {
    if (!materialId) return '-';
    return materials.find(m => m.id === materialId)?.name || '-';
  };

  const getMoldName = (moldId: string | null) => {
    if (!moldId) return '-';
    return molds.find(m => m.id === moldId)?.name || '-';
  };

  const getRecipeName = (recipeId: string | null) => {
    if (!recipeId) return '-';
    return recipes.find(r => r.id === recipeId)?.name || '-';
  };

  const generateQuoteReport = async () => {
    if (!selectedQuoteData) return;

    try {
      const doc = await createPDF();
      let currentY = 14;

      const headerTitle = companySettings.report_header_title || 'ORÇAMENTO DE LAJE TRELIÇADA';
      const headerSubtitle = companySettings.report_header_subtitle || 'Sistema de Gestão';
      const footerText = companySettings.report_footer_text || 'Documento gerado automaticamente pelo sistema';
      const showCompanyInfo = companySettings.report_show_company_info === 'true';
      const showLogo = companySettings.report_show_logo === 'true';
      const companyName = companySettings.company_trade_name || companySettings.company_name || '';
      const logoUrl = companySettings.company_logo_url;

      const pageWidth = doc.internal.pageSize.width;
      const rightMargin = pageWidth - 14;
      const logoWidth = 40;
      const logoHeight = 20;
      let logoStartY = currentY;

      if (showLogo && logoUrl) {
        try {
          const response = await fetch(logoUrl);
          const blob = await response.blob();
          const reader = new FileReader();

          await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const logoData = reader.result as string;
          doc.addImage(logoData, 'PNG', rightMargin - logoWidth, logoStartY, logoWidth, logoHeight);
        } catch (error) {
          console.error('Erro ao carregar logo:', error);
        }
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(headerTitle, 14, currentY, { maxWidth: pageWidth - logoWidth - 24 });
      currentY += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(headerSubtitle, 14, currentY);
      currentY += 8;

      if (companyName) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, 14, currentY);
        currentY += 6;
      }

      if (showCompanyInfo) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const companyInfo = [];
        const address = [
          companySettings.company_address_street,
          companySettings.company_address_number,
          companySettings.company_address_neighborhood,
          companySettings.company_address_city,
          companySettings.company_address_state
        ].filter(Boolean).join(', ');

        if (address) companyInfo.push(address);
        if (companySettings.company_phone) companyInfo.push(`Tel: ${companySettings.company_phone}`);
        if (companySettings.company_email) companyInfo.push(`Email: ${companySettings.company_email}`);

        companyInfo.forEach(info => {
          doc.text(info, 14, currentY, { maxWidth: pageWidth - logoWidth - 24 });
          currentY += 4;
        });
        currentY += 2;
      }

      if (showLogo && logoUrl && currentY < (logoStartY + logoHeight)) {
        currentY = logoStartY + logoHeight + 4;
      }

      doc.setDrawColor(10, 126, 194);
      doc.setLineWidth(0.5);
      doc.line(14, currentY, 196, currentY);
      currentY += 8;

      const customer = customers.find(c => c.id === selectedQuoteData.customer_id);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DADOS DO CLIENTE', 14, currentY);
      currentY += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cliente: ${customer?.name || 'N/A'}`, 14, currentY);
      currentY += 5;
      doc.text(`Orçamento: ${selectedQuoteData.name}`, 14, currentY);
      currentY += 5;
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, currentY);
      currentY += 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('ITENS DO ORÇAMENTO', 14, currentY);
      currentY += 6;

      const totalProjectArea = selectedQuoteData.total_area || 0;
      let finalSalePrice = selectedQuoteData.total_value || 0;

      if (finalSalePrice === 0) {
        const materialCost = calculateCombinedMaterialCost;
        const blocksCost = calculateBlocksCost;
        const laborCost = materialCost * (selectedQuoteData.labor_cost_percentage || 0) / 100;
        const fixedCosts = materialCost * (selectedQuoteData.fixed_costs_percentage || 0) / 100;
        const lossCost = materialCost * (selectedQuoteData.loss_percentage || 0) / 100;
        const totalCost = materialCost + laborCost + fixedCosts + lossCost + (selectedQuoteData.transport_cost || 0);
        const profit = totalCost * (selectedQuoteData.profit_margin_percentage || 0) / 100;
        finalSalePrice = totalCost + profit + blocksCost;
      }

      const unitPrice = totalProjectArea > 0 ? finalSalePrice / totalProjectArea : 0;

      const blockMaterial = materials.find(m => m.id === selectedQuoteData.block_material_id);
      const blockMaterialName = blockMaterial?.name || 'cerâmica';

      const tableData: any[] = [
        [
          totalProjectArea.toFixed(2),
          'm²',
          `Laje treliçada de vigotas de concreto e tavelas ${blockMaterialName}, conforme projeto.`,
          `R$ ${unitPrice.toFixed(2)}`,
          `R$ ${finalSalePrice.toFixed(2)}`
        ]
      ];

      (doc as any).autoTable({
        startY: currentY,
        head: [['Quantidade', 'Unidade', 'Descrição', 'Valor Unitário', 'Valor Total']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [10, 126, 194],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 10
        },
        bodyStyles: {
          textColor: [50, 50, 50],
          fontSize: 9
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'left', cellWidth: 85 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'right', cellWidth: 30 }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('VALOR TOTAL:', 14, currentY);
      doc.text(`R$ ${finalSalePrice.toFixed(2)}`, pageWidth - 14, currentY, { align: 'right' });

      currentY += 20;

      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      const signatureWidth = 70;
      const signatureLeftX = 25;
      const signatureRightX = pageWidth - signatureWidth - 25;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      doc.line(signatureLeftX, currentY, signatureLeftX + signatureWidth, currentY);
      doc.line(signatureRightX, currentY, signatureRightX + signatureWidth, currentY);

      currentY += 5;

      doc.setFont('helvetica', 'bold');
      const companyResponsible = companySettings.company_responsible_name || companyName || '';
      if (companyResponsible) {
        doc.text(companyResponsible, signatureLeftX + (signatureWidth / 2), currentY, { align: 'center' });
      }
      doc.text(customer?.name || 'Cliente', signatureRightX + (signatureWidth / 2), currentY, { align: 'center' });

      currentY += 10;
      doc.setLineWidth(0.5);
      doc.line(14, currentY, 196, currentY);
      currentY += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(footerText, pageWidth / 2, currentY, { align: 'center' });

      doc.save(`orcamento_laje_${selectedQuoteData.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Verifique o console para mais detalhes.');
    }
  };

  const generateCuttingReport = async () => {
    if (rooms.length === 0) {
      alert('Adicione pelo menos um cômodo antes de gerar o relatório de corte.');
      return;
    }

    if (!trussLength || trussLength <= 0) {
      alert('Defina o comprimento da treliça antes de gerar o relatório de corte.');
      return;
    }

    try {
      const doc = await createPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 20;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('PLANO DE CORTE DE VIGOTAS', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (selectedQuoteData) {
        doc.text(`Orçamento: ${selectedQuoteData.name}`, 14, yPosition);
        yPosition += 6;
      }
      doc.text(`Comprimento da Treliça: ${trussLength}m`, 14, yPosition);
      yPosition += 6;
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, yPosition);
      yPosition += 10;

      const cuttingPlan = optimizeCutting(trussLength);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('RESUMO DO PLANO', 14, yPosition);
      yPosition += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Total de Treliças: ${cuttingPlan.totalTrusses}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Eficiência Média: ${cuttingPlan.averageEfficiency.toFixed(1)}%`, 14, yPosition);
      yPosition += 6;
      doc.text(`Perda Real: ${cuttingPlan.totalWaste.toFixed(2)}m (sobras até 0,90m)`, 14, yPosition);
      yPosition += 6;
      if (cuttingPlan.reusableWaste > 0) {
        doc.text(`Sobras Reutilizáveis: ${cuttingPlan.reusableWaste.toFixed(2)}m (sobras acima de 0,90m)`, 14, yPosition);
        yPosition += 6;
      }
      yPosition += 4;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('NECESSIDADE DE VIGOTAS POR CÔMODO', 14, yPosition);
      yPosition += 6;

      const roomsData = rooms.map(room => [
        room.name,
        `${room.joist_count}`,
        `${room.joist_length}m`
      ]);

      (doc as any).autoTable({
        startY: yPosition,
        head: [['Cômodo', 'Quantidade', 'Comprimento']],
        body: roomsData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 9 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;

      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('QUANTIDADE DE TAVELAS/BLOCOS', 14, yPosition);
      yPosition += 6;

      const blockCalcCutting = calculateTotalBlocks();
      const blocksDataCutting = blockCalcCutting.roomCalculations.map(calc => [
        calc.roomName,
        `${calc.blockSideA}×${calc.blockSideB}m`,
        `${calc.finalQuantity}`
      ]);

      (doc as any).autoTable({
        startY: yPosition,
        head: [['Cômodo', 'Dimensão Tavela', 'Quantidade']],
        body: blocksDataCutting,
        theme: 'grid',
        headStyles: { fillColor: [20, 184, 166], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          2: { halign: 'right', fontStyle: 'bold' }
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`TOTAL DE TAVELAS: ${blockCalcCutting.totalBlocks}`, 14, yPosition);
      yPosition += 10;

      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('PADRÕES DE CORTE', 14, yPosition);
      yPosition += 6;

      cuttingPlan.patterns.forEach((patternGroup, idx) => {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`Padrão ${idx + 1} - Usar ${patternGroup.quantity}× este padrão`, 14, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Eficiência: ${patternGroup.pattern.efficiency.toFixed(1)}%`, 14, yPosition);
        doc.text(`Perda por treliça: ${patternGroup.pattern.waste.toFixed(2)}m`, 80, yPosition);
        yPosition += 6;

        doc.setFont('helvetica', 'bold');
        doc.text('Cortes:', 20, yPosition);
        yPosition += 5;

        doc.setFont('helvetica', 'normal');
        patternGroup.pattern.pattern.forEach(item => {
          doc.text(`• ${item.count}× vigotas de ${item.length}m`, 25, yPosition);
          yPosition += 5;
        });

        yPosition += 5;

        if (yPosition > 220) {
          doc.addPage();
          yPosition = 20;
        }

        const drawingStartX = 25;
        const drawingWidth = pageWidth - 50;
        const trussLengthScale = drawingWidth / trussLength;
        const barHeight = 8;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Visualização do Padrão de Corte:', drawingStartX, yPosition);
        yPosition += 6;

        doc.setDrawColor(100, 100, 100);
        doc.setFillColor(220, 220, 220);
        doc.rect(drawingStartX, yPosition, drawingWidth, barHeight, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`${trussLength}m`, drawingStartX + drawingWidth / 2, yPosition + barHeight + 4, { align: 'center' });

        yPosition += barHeight + 8;

        const colors = [
          [59, 130, 246],
          [16, 185, 129],
          [245, 158, 11],
          [239, 68, 68],
          [139, 92, 246],
          [236, 72, 153]
        ];

        let currentPosition = 0;
        patternGroup.pattern.pattern.forEach((item, colorIdx) => {
          const color = colors[colorIdx % colors.length];
          doc.setFillColor(color[0], color[1], color[2]);
          doc.setDrawColor(0, 0, 0);

          for (let i = 0; i < item.count; i++) {
            const segmentWidth = item.length * trussLengthScale;
            doc.rect(drawingStartX + currentPosition, yPosition, segmentWidth, barHeight, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(255, 255, 255);
            doc.text(`${item.length}m`, drawingStartX + currentPosition + segmentWidth / 2, yPosition + barHeight / 2 + 2, { align: 'center' });
            doc.setTextColor(0, 0, 0);

            currentPosition += segmentWidth;
          }
        });

        if (patternGroup.pattern.waste > 0) {
          const wasteWidth = patternGroup.pattern.waste * trussLengthScale;
          doc.setFillColor(200, 200, 200);
          doc.setDrawColor(100, 100, 100);
          doc.rect(drawingStartX + currentPosition, yPosition, wasteWidth, barHeight, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.text('perda', drawingStartX + currentPosition + wasteWidth / 2, yPosition + barHeight / 2 + 2, { align: 'center' });
        }

        yPosition += barHeight + 10;

        doc.setDrawColor(200, 200, 200);
        doc.line(14, yPosition, pageWidth - 14, yPosition);
        yPosition += 8;
      });

      yPosition += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('RESUMO TOTAL', 14, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.text(`Treliças necessárias: ${cuttingPlan.totalTrusses}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Perda real: ${cuttingPlan.totalWaste.toFixed(2)}m (sobras até 0,90m)`, 14, yPosition);
      yPosition += 6;
      if (cuttingPlan.reusableWaste > 0) {
        doc.text(`Sobras reutilizáveis: ${cuttingPlan.reusableWaste.toFixed(2)}m (acima de 0,90m)`, 14, yPosition);
        yPosition += 6;
      }
      doc.text(`Aproveitamento médio: ${cuttingPlan.averageEfficiency.toFixed(1)}%`, 14, yPosition);

      doc.save(`plano_corte_${selectedQuoteData?.name.replace(/\s+/g, '_') || 'vigotas'}.pdf`);

      alert('Relatório de corte gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar relatório de corte:', error);
      alert('Erro ao gerar relatório de corte. Verifique se todos os campos estão preenchidos corretamente e tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      {receivableId && onBackToSale && (
        <div className="bg-gradient-to-r from-blue-50 to-teal-50 border-2 border-blue-300 rounded-lg p-4 shadow-md">
          <button
            onClick={() => onBackToSale(receivableId)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar para Venda
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Você acessou este orçamento via módulo de vendas. Clique no botão acima para voltar à venda.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Orçamento de Laje Treliçada</h2>
        <button
          onClick={() => setShowQuoteForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Projeto
        </button>
      </div>

      {showQuoteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingQuote ? 'Editar Projeto' : 'Novo Projeto'}
              </h3>
              <button onClick={handleCancelQuote} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Projeto *
                </label>
                <input
                  type="text"
                  value={quoteForm.name}
                  onChange={(e) => setQuoteForm({ ...quoteForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Obra Residencial João Silva"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente
                </label>
                <select
                  value={quoteForm.customer_id}
                  onChange={(e) => setQuoteForm({ ...quoteForm, customer_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um cliente</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Pavimentos *
                  </label>
                </div>

                <div className="space-y-3">
                  {tempFloors.map((floor, index) => (
                    <div key={floor.id || `temp-${index}`} className="bg-gray-50 border rounded-lg p-3">
                      <div className="grid grid-cols-12 gap-3 items-start">
                        <div className="col-span-5">
                          <label className="block text-xs text-gray-600 mb-1">Nome do Pavimento</label>
                          <input
                            type="text"
                            value={floor.name}
                            onChange={(e) => {
                              const newFloors = [...tempFloors];
                              newFloors[index].name = e.target.value;
                              setTempFloors(newFloors);
                            }}
                            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: Térreo, 1º Andar"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs text-gray-600 mb-1">Área (m²)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={floor.area}
                            onChange={(e) => {
                              const newFloors = [...tempFloors];
                              newFloors[index].area = parseFloat(e.target.value) || 0;
                              setTempFloors(newFloors);
                            }}
                            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-600 mb-1">Ordem</label>
                          <input
                            type="number"
                            value={floor.display_order}
                            onChange={(e) => {
                              const newFloors = [...tempFloors];
                              newFloors[index].display_order = parseInt(e.target.value) || 0;
                              setTempFloors(newFloors);
                            }}
                            className="w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div className="col-span-2 flex items-end">
                          <button
                            type="button"
                            onClick={() => {
                              const newFloors = tempFloors.filter((_, i) => i !== index);
                              setTempFloors(newFloors);
                            }}
                            className="w-full px-2 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setTempFloors([...tempFloors, {
                        name: tempFloors.length === 0 ? 'Térreo' : `${tempFloors.length}º Andar`,
                        display_order: tempFloors.length,
                        area: 0,
                        notes: '',
                        isNew: true
                      }]);
                    }}
                    className="w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {tempFloors.length === 0 ? 'Adicionar Pavimento Térreo' : 'Adicionar Pavimento'}
                  </button>

                  {tempFloors.length === 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      Adicione pelo menos um pavimento (ex: Térreo) para continuar
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Espaçamento entre Vigotas (m) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={quoteForm.joist_spacing}
                  onChange={(e) => setQuoteForm({ ...quoteForm, joist_spacing: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tavela - Lado A (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={quoteForm.block_side_a}
                    onChange={(e) => setQuoteForm({ ...quoteForm, block_side_a: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tavela - Lado B (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={quoteForm.block_side_b}
                    onChange={(e) => setQuoteForm({ ...quoteForm, block_side_b: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material da Tavela (Insumo)
                </label>
                <select
                  value={quoteForm.block_material_id}
                  onChange={(e) => {
                    const materialId = e.target.value;
                    const selectedMaterial = materials.find(m => m.id === materialId);
                    setQuoteForm({
                      ...quoteForm,
                      block_material_id: materialId,
                      block_unit_price: selectedMaterial?.resale_price || 0
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione o insumo da tavela</option>
                  {materials.map(material => (
                    <option key={material.id} value={material.id}>
                      {material.name} - R$ {(material.resale_price || 0).toFixed(2)} (Revenda)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor de Revenda da Tavela (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={quoteForm.block_unit_price}
                  onChange={(e) => setQuoteForm({ ...quoteForm, block_unit_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Já com impostos e margem"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={quoteForm.notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Observações adicionais"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={handleCancelQuote}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveQuote}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-900">Projetos</h3>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {quotes.map(quote => (
                <div
                  key={quote.id}
                  ref={quote.id === highlightQuoteId ? highlightedQuoteRef : null}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedQuote === quote.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  } ${
                    quote.id === highlightQuoteId ? 'bg-yellow-50 border-l-4 border-yellow-500 animate-pulse' : ''
                  }`}
                  onClick={() => setSelectedQuote(quote.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{quote.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          quote.status === 'approved' ? 'bg-green-100 text-green-800' :
                          quote.status === 'in_production' ? 'bg-blue-100 text-blue-800' :
                          quote.status === 'sent' ? 'bg-yellow-100 text-yellow-800' :
                          quote.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {quote.status === 'approved' ? 'Aprovado' :
                           quote.status === 'in_production' ? 'Em Produção' :
                           quote.status === 'sent' ? 'Enviado' :
                           quote.status === 'rejected' ? 'Rejeitado' :
                           'Rascunho'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Cliente: {getCustomerName(quote.customer_id)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Área: {quote.total_area} m²
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditQuote(quote);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQuote(quote.id);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {quotes.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  Nenhum projeto cadastrado
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedQuote ? (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedQuoteData?.name}</h3>
                    <p className="text-sm text-gray-500">
                      Espaçamento: {selectedQuoteData?.joist_spacing}m |
                      Tavela: {selectedQuoteData?.block_side_a}m × {selectedQuoteData?.block_side_b}m
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setShowCalculation(!showCalculation)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Calculator className="w-4 h-4" />
                      Memória de Cálculo
                    </button>
                    <button
                      onClick={() => setShowBlockCalculation(!showBlockCalculation)}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      <Box className="w-4 h-4" />
                      Cálculo de Tavelas
                    </button>
                    <button
                      onClick={generateQuoteReport}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      title="Gerar relatório de orçamento"
                    >
                      <Download className="w-4 h-4" />
                      Relatório Orçamento
                    </button>
                    <button
                      onClick={generateCuttingReport}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                      title="Gerar relatório de corte para produção"
                    >
                      <Scissors className="w-4 h-4" />
                      Relatório Corte
                    </button>
                    <button
                      onClick={() => setShowRoomForm(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Cômodo
                    </button>
                  </div>
                </div>

                {/* Barra de Status e Ações */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Status do Orçamento</label>
                        <span className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-semibold ${
                          selectedQuoteData?.status === 'approved' ? 'bg-green-100 text-green-800 border border-green-300' :
                          selectedQuoteData?.status === 'in_production' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                          selectedQuoteData?.status === 'sent' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                          selectedQuoteData?.status === 'rejected' ? 'bg-red-100 text-red-800 border border-red-300' :
                          'bg-gray-100 text-gray-800 border border-gray-300'
                        }`}>
                          {selectedQuoteData?.status === 'approved' && <CheckCircle className="w-4 h-4" />}
                          {selectedQuoteData?.status === 'rejected' && <X className="w-4 h-4" />}
                          {selectedQuoteData?.status === 'approved' ? 'Aprovado' :
                           selectedQuoteData?.status === 'in_production' ? 'Em Produção' :
                           selectedQuoteData?.status === 'sent' ? 'Enviado' :
                           selectedQuoteData?.status === 'rejected' ? 'Rejeitado' :
                           'Rascunho'}
                        </span>
                      </div>
                      {selectedQuoteData?.status === 'approved' && selectedQuoteData?.approved_at && (
                        <div className="text-xs text-gray-600">
                          <p className="font-medium">Aprovado em: {new Date(selectedQuoteData.approved_at).toLocaleDateString('pt-BR')}</p>
                          {selectedQuoteData.approved_by && <p>Por: {selectedQuoteData.approved_by}</p>}
                          {selectedQuoteData.production_order_id && (
                            <p className="text-green-700 font-medium mt-1">
                              <CheckCircle className="w-3 h-3 inline mr-1" />
                              Ordem de Produção Gerada
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {selectedQuoteData?.status === 'draft' && (
                        <button
                          onClick={() => handleChangeStatus('sent')}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
                        >
                          Marcar como Enviado
                        </button>
                      )}
                      {(selectedQuoteData?.status === 'draft' || selectedQuoteData?.status === 'sent') && (
                        <button
                          onClick={handleApproveQuote}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                        >
                          Aprovar Orçamento
                        </button>
                      )}
                      {(selectedQuoteData?.status === 'draft' || selectedQuoteData?.status === 'sent') && (
                        <button
                          onClick={() => handleChangeStatus('rejected')}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                        >
                          Rejeitar
                        </button>
                      )}
                      {selectedQuoteData?.status === 'approved' && !selectedQuoteData?.production_order_id && (
                        <button
                          onClick={handleApproveQuote}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                        >
                          Gerar Ordem de Produção
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {showCalculation && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2 mb-3">
                      <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-blue-900 mb-2">Memória de Cálculo</h4>
                        <div className="space-y-2 text-sm text-blue-900">
                          <div className="bg-white rounded p-3">
                            <p className="font-semibold mb-2">Fórmulas Utilizadas:</p>
                            <ul className="space-y-1 list-disc list-inside">
                              <li><strong>Comprimento da Vigota:</strong> Menor lado do cômodo + 0,10m</li>
                              <li><strong>Quantidade de Vigotas:</strong> Maior lado ÷ Espaçamento entre vigotas</li>
                              <li className="ml-6 text-xs">
                                • Se resultado quebrado entre 0,10 e 0,12: adicionar +1 vigota
                              </li>
                              <li><strong>Volume de Concreto Total:</strong> Volume por vigota × Quantidade de vigotas</li>
                            </ul>
                          </div>

                          {rooms.length > 0 && (
                            <div className="bg-white rounded p-3">
                              <p className="font-semibold mb-2">Totalizadores do Projeto:</p>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-gray-600">Total de Cômodos</p>
                                  <p className="text-lg font-bold">{rooms.length}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600">Total de Vigotas</p>
                                  <p className="text-lg font-bold">
                                    {roomsSummary.totalJoists}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600">Comprimento Total</p>
                                  <p className="text-lg font-bold">
                                    {roomsSummary.totalJoistLength.toFixed(2)}m
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600">Volume Total de Concreto</p>
                                  <p className="text-lg font-bold">
                                    {roomsSummary.totalConcreteVolume.toFixed(4)} m³
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showBlockCalculation && rooms.length > 0 && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <Box className="w-5 h-5 text-teal-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-teal-900 mb-3">Cálculo de Tavelas/Blocos por Cômodo</h4>

                        <div className="bg-white rounded p-3 mb-3">
                          <p className="font-semibold text-sm text-teal-900 mb-2">Fórmula de Cálculo:</p>
                          <ul className="space-y-1 text-xs text-teal-800 list-disc list-inside">
                            <li><strong>Tavelas por metro:</strong> 1 ÷ Menor lado da tavela</li>
                            <li><strong>Número de vãos:</strong> Maior lado ÷ Espaçamento (considerando regra 0,10-0,12)</li>
                            <li><strong>Total:</strong> Comprimento do vão × Tavelas/metro × Número de vãos</li>
                            <li><strong>Perda:</strong> Acréscimo de 10% ao cálculo final</li>
                          </ul>
                        </div>

                        <div className="space-y-3">
                          {calculateTotalBlocks().roomCalculations.map((calc, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-4 border border-teal-100">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="font-bold text-teal-900">{calc.roomName}</h5>
                                <span className="px-3 py-1 bg-teal-600 text-white text-sm font-bold rounded-full">
                                  {calc.finalQuantity} tavelas
                                </span>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                                <div>
                                  <p className="text-gray-600">Dimensão Tavela</p>
                                  <p className="font-semibold">{calc.blockSideA}m × {calc.blockSideB}m</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Menor Lado</p>
                                  <p className="font-semibold text-teal-600">{calc.smallerBlockSide}m</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Tavelas/metro</p>
                                  <p className="font-semibold text-teal-600">{calc.blocksPerMeter} pç/m</p>
                                </div>
                                <div>
                                  <p className="text-gray-600">Comp. do Vão</p>
                                  <p className="font-semibold">{calc.gapLength}m</p>
                                </div>
                              </div>

                              <div className="bg-teal-50 rounded-lg p-3 mb-3">
                                <div className="grid grid-cols-3 gap-3 text-xs">
                                  <div>
                                    <p className="text-gray-600">Número de Vãos</p>
                                    <p className="font-bold text-teal-700 text-lg">{calc.numberOfGaps}</p>
                                    <p className="text-xs text-gray-500 mt-1">Decimal: {calc.decimalPart}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Cálculo</p>
                                    <p className="text-xs text-gray-700 mt-1">
                                      {calc.gapLength}m × {calc.blocksPerMeter} × {calc.numberOfGaps}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600">Resultado</p>
                                    <p className="font-bold text-teal-700 text-lg">{calc.blocksByGapMethod}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-blue-50 rounded-lg p-2">
                                <p className="text-xs text-gray-600">Comparativo por área: <span className="font-semibold text-blue-700">{calc.blocksByAreaMethod} tavelas</span></p>
                              </div>

                              <div className="mt-3 pt-3 border-t border-teal-100 flex justify-between items-center">
                                <div className="text-xs">
                                  <span className="text-gray-600">Perda 10%: </span>
                                  <span className="font-semibold text-amber-600">+{calc.wasteQuantity} tavelas</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-600">Quantidade Final</p>
                                  <p className="text-lg font-bold text-teal-900">{calc.finalQuantity}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 bg-teal-600 text-white rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-teal-100 text-sm">Total do Projeto</p>
                              <p className="text-2xl font-bold">{calculateTotalBlocks().totalBlocks} tavelas</p>
                            </div>
                            <Box className="w-12 h-12 opacity-50" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cômodo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dimensões</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insumo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fôrma</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qtd Vigotas</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Compr. Vigota</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Compr. Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vol. Concreto</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rooms.map(room => (
                        <tr key={room.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{room.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {room.side_a} × {room.side_b}m
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {room.slab_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{getMaterialName(room.material_id)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{getMoldName(room.mold_id)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{room.joist_count}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{room.joist_length}m</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-semibold">{(room.joist_count * room.joist_length).toFixed(2)}m</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{room.total_concrete_volume.toFixed(4)} m³</td>
                          <td className="px-4 py-3 text-sm text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEditRoom(room)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRoom(room.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {rooms.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                            Nenhum cômodo cadastrado. Clique em "Adicionar Cômodo" para começar.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {rooms.length > 0 && (
                <>
                  {/* Tabela de Orçamento de Materiais */}
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden mt-6">
                    <div className="px-6 py-4 border-b bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900">Orçamento de Materiais</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insumo</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Comprimento Total</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo/Metro</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {Array.from(new Set(rooms.map(r => r.material_id))).filter(id => id).map(materialId => {
                            const material = materials.find(m => m.id === materialId);
                            const materialRooms = rooms.filter(r => r.material_id === materialId);
                            const totalLength = materialRooms.reduce((sum, room) =>
                              sum + (room.joist_count * room.joist_length), 0
                            );
                            const costPerMeter = material?.cost_per_meter || material?.unit_cost || 0;
                            const totalCost = totalLength * costPerMeter;

                            return (
                              <tr key={materialId} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {material?.name || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {totalLength.toFixed(2)}m
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  R$ {costPerMeter.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                  R$ {totalCost.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-100 font-bold">
                            <td colSpan={3} className="px-4 py-3 text-sm text-gray-900 text-right">
                              Total de Materiais:
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              R$ {calculateTotalMaterialCost.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Consumo de Materiais por Traço */}
                  {rooms.length > 0 && rooms.some(r => r.recipe_id) && (
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden mt-6">
                      <div className="px-6 py-4 border-b bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-900">Consumo de Materiais do Traço</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Detalhamento dos insumos necessários baseado no volume de concreto e traços selecionados
                        </p>
                      </div>
                      <div className="p-6">
                        {(() => {
                          const consumption = calculateMaterialConsumption(rooms);
                          const totalVolume = rooms.reduce((sum, room) => sum + room.total_concrete_volume, 0);

                          return (
                            <>
                              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-blue-900">Volume Total de Concreto</p>
                                    <p className="text-xs text-blue-700 mt-1">Base para cálculo de consumo</p>
                                  </div>
                                  <p className="text-2xl font-bold text-blue-900">
                                    {totalVolume.toFixed(4)} m³
                                  </p>
                                </div>
                              </div>

                              {consumption.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="bg-gray-50 border-b">
                                      <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                          Material
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                          Unidade
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                          Quantidade Total
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                          Valor Unitário
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                          Valor Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {consumption.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            {item.material_name}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-600">
                                            {item.unit}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                            {item.total_quantity.toLocaleString('pt-BR', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2
                                            })} {item.unit}
                                          </td>
                                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                            R$ {item.unit_price.toLocaleString('pt-BR', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2
                                            })}
                                          </td>
                                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                                            R$ {item.total_price.toLocaleString('pt-BR', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2
                                            })}
                                          </td>
                                        </tr>
                                      ))}
                                      <tr className="bg-gray-100 font-bold border-t-2">
                                        <td colSpan={4} className="px-4 py-3 text-sm text-gray-900 text-right">
                                          Total dos Materiais do Traço:
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                          R$ {consumption.reduce((sum, item) => sum + item.total_price, 0).toLocaleString('pt-BR', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                          })}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-center py-8">
                                  <p className="text-gray-500">
                                    Nenhum traço configurado nos cômodos.
                                    Configure os traços dos cômodos para visualizar o consumo de materiais.
                                  </p>
                                </div>
                              )}

                              {consumption.length > 0 && (
                                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                  <p className="text-xs text-amber-800">
                                    <strong>Nota:</strong> As quantidades são calculadas com base nos traços configurados.
                                    Volume de concreto × Quantidade do material no traço (por m³).
                                    Considere adicionar uma margem de segurança para perdas no processo.
                                  </p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Otimização de Corte de Vigotas */}
                  {rooms.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden mt-6">
                      <div className="px-6 py-4 border-b bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-900">Otimização de Corte de Vigotas</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Plano de corte otimizado para minimizar desperdício de treliças
                        </p>
                      </div>
                      <div className="p-6">
                        {/* Seleção de Comprimento da Treliça */}
                        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                          <label className="block text-sm font-medium text-gray-900 mb-3">
                            Comprimento da Treliça Disponível
                          </label>
                          <div className="flex gap-4">
                            <button
                              onClick={() => setTrussLength(6)}
                              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                                trussLength === 6
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              6 metros
                            </button>
                            <button
                              onClick={() => setTrussLength(12)}
                              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                                trussLength === 12
                                  ? 'bg-blue-600 text-white shadow-md'
                                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              12 metros
                            </button>
                          </div>
                        </div>

                        {(() => {
                          const cuttingPlan = optimizeCutting(trussLength);

                          return (
                            <>
                              {/* Resumo do Plano */}
                              <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                                  <p className="text-xs font-medium text-blue-700 uppercase mb-1">Total de Treliças</p>
                                  <p className="text-3xl font-bold text-blue-900">{cuttingPlan.totalTrusses}</p>
                                  <p className="text-xs text-blue-600 mt-1">treliças de {trussLength}m</p>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                                  <p className="text-xs font-medium text-green-700 uppercase mb-1">Eficiência Média</p>
                                  <p className="text-3xl font-bold text-green-900">{cuttingPlan.averageEfficiency.toFixed(1)}%</p>
                                  <p className="text-xs text-green-600 mt-1">aproveitamento</p>
                                </div>
                                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                                  <p className="text-xs font-medium text-amber-700 uppercase mb-1">Perda Real</p>
                                  <p className="text-3xl font-bold text-amber-900">{cuttingPlan.totalWaste.toFixed(2)}m</p>
                                  <p className="text-xs text-amber-600 mt-1">sobras até 0,90m</p>
                                </div>
                                {cuttingPlan.reusableWaste > 0 && (
                                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                                    <p className="text-xs font-medium text-green-700 uppercase mb-1">Sobras Reutilizáveis</p>
                                    <p className="text-3xl font-bold text-green-900">{cuttingPlan.reusableWaste.toFixed(2)}m</p>
                                    <p className="text-xs text-green-600 mt-1">sobras acima de 0,90m</p>
                                  </div>
                                )}
                              </div>

                              {/* Necessidade de Vigotas por Cômodo */}
                              <div className="mb-6">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Resumo de Vigotas Necessárias</h4>
                                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                  {rooms.map(room => (
                                    <div key={room.id} className="space-y-1">
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-700">{room.name}</span>
                                        <span className="text-sm font-semibold text-gray-900">
                                          {room.joist_count} vigotas × {room.joist_length}m
                                        </span>
                                      </div>
                                      {room.needs_reinforcement && room.reinforcement_material_id && (
                                        <div className="flex justify-between items-center pl-4 border-l-2 border-orange-400">
                                          <span className="text-xs text-orange-700 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Reforço: {materials.find(m => m.id === room.reinforcement_material_id)?.name || 'Material'}
                                          </span>
                                          <span className="text-xs font-semibold text-orange-800">
                                            {room.joist_count} unidades × {room.joist_length}m
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Padrões de Corte */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Padrões de Corte Otimizados</h4>
                                <div className="space-y-4">
                                  {cuttingPlan.patterns.map((patternGroup, idx) => (
                                    <div key={idx} className="border rounded-lg overflow-hidden">
                                      <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                                        <div>
                                          <span className="text-sm font-semibold text-gray-900">
                                            Padrão {idx + 1}
                                          </span>
                                          <span className="ml-3 text-xs text-gray-600">
                                            Usar {patternGroup.quantity}× este padrão
                                          </span>
                                        </div>
                                        <div className="text-right">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            patternGroup.pattern.efficiency >= 95 ? 'bg-green-100 text-green-800' :
                                            patternGroup.pattern.efficiency >= 85 ? 'bg-blue-100 text-blue-800' :
                                            'bg-amber-100 text-amber-800'
                                          }`}>
                                            {patternGroup.pattern.efficiency.toFixed(1)}% eficiência
                                          </span>
                                        </div>
                                      </div>
                                      <div className="p-4">
                                        {/* Visualização Gráfica do Corte */}
                                        <div className="mb-3">
                                          <div className="relative h-12 bg-gray-200 rounded-lg overflow-hidden">
                                            {(() => {
                                              let currentPosition = 0;
                                              const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];

                                              return (
                                                <>
                                                  {patternGroup.pattern.pattern.map((item, i) => (
                                                    Array.from({ length: item.count }).map((_, j) => {
                                                      const widthPercent = (item.length / trussLength) * 100;
                                                      const leftPercent = (currentPosition / trussLength) * 100;
                                                      currentPosition += item.length;

                                                      return (
                                                        <div
                                                          key={`${i}-${j}`}
                                                          className={`absolute h-full ${colors[i % colors.length]} border-r-2 border-white flex items-center justify-center`}
                                                          style={{
                                                            left: `${leftPercent}%`,
                                                            width: `${widthPercent}%`
                                                          }}
                                                        >
                                                          <span className="text-xs font-bold text-white">
                                                            {item.length}m
                                                          </span>
                                                        </div>
                                                      );
                                                    })
                                                  ))}
                                                  {patternGroup.pattern.waste > 0 && (
                                                    <div
                                                      className="absolute h-full bg-red-300 flex items-center justify-center"
                                                      style={{
                                                        left: `${((trussLength - patternGroup.pattern.waste) / trussLength) * 100}%`,
                                                        width: `${(patternGroup.pattern.waste / trussLength) * 100}%`
                                                      }}
                                                    >
                                                      <span className="text-xs font-bold text-red-800">
                                                        perda
                                                      </span>
                                                    </div>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                          <div className="flex justify-between mt-1 text-xs text-gray-500">
                                            <span>0m</span>
                                            <span>{trussLength}m</span>
                                          </div>
                                        </div>

                                        {/* Detalhamento do Padrão */}
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                          <div>
                                            <span className="font-medium text-gray-700">Cortes:</span>
                                            <div className="mt-1 space-y-1">
                                              {patternGroup.pattern.pattern.map((item, i) => {
                                                const roomsWithLength = rooms.filter(r => r.joist_length === item.length);
                                                const hasReinforcement = roomsWithLength.some(r => r.needs_reinforcement);

                                                return (
                                                  <div key={i} className="space-y-1">
                                                    <div className="text-gray-600">
                                                      {item.count}× de {item.length}m
                                                    </div>
                                                    {hasReinforcement && (
                                                      <div className="pl-3 text-xs text-orange-700 flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Com reforço estrutural
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                          <div>
                                            <span className="font-medium text-gray-700">Perda por treliça:</span>
                                            <div className="mt-1">
                                              <span className={`text-lg font-bold ${
                                                patternGroup.pattern.waste < 0.5 ? 'text-green-600' :
                                                patternGroup.pattern.waste < 1.0 ? 'text-amber-600' :
                                                'text-red-600'
                                              }`}>
                                                {patternGroup.pattern.waste.toFixed(2)}m
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Tabela de Precificação */}
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden mt-6">
                    <div className="px-6 py-4 border-b bg-gray-50">
                      <h3 className="text-lg font-semibold text-gray-900">Precificação Final</h3>
                    </div>
                    <div className="p-6">
                      <div className="space-y-4">
                        {/* Custo de Materiais (somente leitura) */}
                        <div className="space-y-3 pb-4 border-b">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-600">
                                Custo das Vigotas (Material)
                              </label>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-semibold text-gray-900">
                                R$ {calculateTotalMaterialCost.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {rooms.some(r => r.recipe_id) && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-600">
                                  Custo dos Insumos do Traço
                                </label>
                              </div>
                              <div className="text-right">
                                <span className="text-base font-semibold text-gray-900">
                                  R$ {calculateRecipeMaterialsCost.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                          {trussMaterial && calculateTrussWasteCost > 0 && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-amber-700">
                                  Perda de Treliça no Corte
                                </label>
                                <p className="text-xs text-amber-600">
                                  {optimizeCutting(trussLength).totalWaste.toFixed(2)}m × R$ {(trussMaterial.cost_per_meter || trussMaterial.unit_cost).toFixed(2)}/m
                                </p>
                                <p className="text-xs text-gray-500 italic">
                                  Sobras até 0,90m (não reutilizáveis)
                                </p>
                                {optimizeCutting(trussLength).reusableWaste > 0 && (
                                  <p className="text-xs text-green-600 italic mt-1">
                                    + {optimizeCutting(trussLength).reusableWaste.toFixed(2)}m reutilizáveis {`(>0,90m)`}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-base font-semibold text-amber-700">
                                  R$ {calculateTrussWasteCost.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                          {calculateReinforcementCost > 0 && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-blue-700">
                                  Reforço Estrutural
                                </label>
                                <p className="text-xs text-blue-600">
                                  Armaduras adicionais
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-base font-semibold text-blue-700">
                                  R$ {calculateReinforcementCost.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                            <div>
                              <label className="block text-sm font-bold text-gray-900">
                                Total de Materiais
                              </label>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold text-gray-900">
                                R$ {calculateCombinedMaterialCost.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Campos editáveis */}
                        <div className="grid grid-cols-2 gap-4 items-center">
                          <label className="text-sm font-medium text-gray-700">
                            Mão de Obra (% sobre materiais)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={pricingForm.labor_cost_percentage}
                              onChange={(e) => setPricingForm({...pricingForm, labor_cost_percentage: parseFloat(e.target.value) || 0})}
                              className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
                              step="0.01"
                            />
                            <span className="text-sm text-gray-600 w-8">%</span>
                            <span className="text-sm font-semibold text-gray-900 w-32 text-right">
                              R$ {(calculateCombinedMaterialCost * pricingForm.labor_cost_percentage / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 items-center">
                          <label className="text-sm font-medium text-gray-700">
                            Custos Fixos (% sobre materiais)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={pricingForm.fixed_costs_percentage}
                              onChange={(e) => setPricingForm({...pricingForm, fixed_costs_percentage: parseFloat(e.target.value) || 0})}
                              className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
                              step="0.01"
                            />
                            <span className="text-sm text-gray-600 w-8">%</span>
                            <span className="text-sm font-semibold text-gray-900 w-32 text-right">
                              R$ {(calculateCombinedMaterialCost * pricingForm.fixed_costs_percentage / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 items-center">
                          <label className="text-sm font-medium text-gray-700">
                            Perdas (% sobre materiais)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={pricingForm.loss_percentage}
                              onChange={(e) => setPricingForm({...pricingForm, loss_percentage: parseFloat(e.target.value) || 0})}
                              className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
                              step="0.01"
                            />
                            <span className="text-sm text-gray-600 w-8">%</span>
                            <span className="text-sm font-semibold text-gray-900 w-32 text-right">
                              R$ {(calculateCombinedMaterialCost * pricingForm.loss_percentage / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 items-center">
                          <label className="text-sm font-medium text-gray-700">
                            Transporte (valor fixo)
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">R$</span>
                            <input
                              type="number"
                              value={pricingForm.transport_cost}
                              onChange={(e) => setPricingForm({...pricingForm, transport_cost: parseFloat(e.target.value) || 0})}
                              className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
                              step="0.01"
                            />
                            <span className="text-sm font-semibold text-gray-900 w-32 text-right">
                              R$ {pricingForm.transport_cost.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Subtotal */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                          <div>
                            <label className="block text-sm font-semibold text-gray-900">
                              Custo Total
                            </label>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-gray-900">
                              R$ {(() => {
                                const materialCost = calculateCombinedMaterialCost;
                                const laborCost = materialCost * pricingForm.labor_cost_percentage / 100;
                                const fixedCosts = materialCost * pricingForm.fixed_costs_percentage / 100;
                                const lossCost = materialCost * pricingForm.loss_percentage / 100;
                                return (materialCost + laborCost + fixedCosts + lossCost + pricingForm.transport_cost).toFixed(2);
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Margem de Lucro */}
                        <div className="grid grid-cols-2 gap-4 items-center pt-4 border-t">
                          <label className="text-sm font-medium text-gray-700">
                            Margem de Lucro (% sobre custo total)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={pricingForm.profit_margin_percentage}
                              onChange={(e) => setPricingForm({...pricingForm, profit_margin_percentage: parseFloat(e.target.value) || 0})}
                              className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-right"
                              step="0.01"
                            />
                            <span className="text-sm text-gray-600 w-8">%</span>
                            <span className="text-sm font-semibold text-gray-900 w-32 text-right">
                              R$ {(() => {
                                const materialCost = calculateCombinedMaterialCost;
                                const laborCost = materialCost * pricingForm.labor_cost_percentage / 100;
                                const fixedCosts = materialCost * pricingForm.fixed_costs_percentage / 100;
                                const lossCost = materialCost * pricingForm.loss_percentage / 100;
                                const totalCost = materialCost + laborCost + fixedCosts + lossCost + pricingForm.transport_cost;
                                return (totalCost * pricingForm.profit_margin_percentage / 100).toFixed(2);
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Custo das Tavelas */}
                        {calculateBlocksCost > 0 && (
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                            <div>
                              <label className="block text-sm font-medium text-teal-700">
                                Tavelas (valor de revenda)
                              </label>
                              <p className="text-xs text-teal-600">
                                {calculateTotalBlocks().totalBlocks} un × R$ {selectedQuoteData?.block_unit_price.toFixed(2)}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-semibold text-teal-700">
                                R$ {calculateBlocksCost.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Preço Final */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t bg-blue-50 -mx-6 px-6 py-4 mt-4">
                          <div>
                            <label className="block text-lg font-bold text-blue-900">
                              Preço Final de Venda
                            </label>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-blue-900">
                              R$ {(() => {
                                const materialCost = calculateCombinedMaterialCost;
                                const laborCost = materialCost * pricingForm.labor_cost_percentage / 100;
                                const fixedCosts = materialCost * pricingForm.fixed_costs_percentage / 100;
                                const lossCost = materialCost * pricingForm.loss_percentage / 100;
                                const totalCost = materialCost + laborCost + fixedCosts + lossCost + pricingForm.transport_cost;
                                const profit = totalCost * pricingForm.profit_margin_percentage / 100;
                                const blocksCost = calculateBlocksCost;
                                return (totalCost + profit + blocksCost).toFixed(2);
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Valor por m² */}
                        <div className="grid grid-cols-2 gap-4 bg-green-50 -mx-6 px-6 py-3">
                          <div>
                            <label className="block text-base font-semibold text-green-900">
                              Valor por m²
                            </label>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-bold text-green-900">
                              R$ {(() => {
                                const materialCost = calculateCombinedMaterialCost;
                                const laborCost = materialCost * pricingForm.labor_cost_percentage / 100;
                                const fixedCosts = materialCost * pricingForm.fixed_costs_percentage / 100;
                                const lossCost = materialCost * pricingForm.loss_percentage / 100;
                                const totalCost = materialCost + laborCost + fixedCosts + lossCost + pricingForm.transport_cost;
                                const profit = totalCost * pricingForm.profit_margin_percentage / 100;
                                const blocksCost = calculateBlocksCost;
                                const finalPrice = totalCost + profit + blocksCost;
                                const totalArea = selectedQuoteData?.total_area || 0;
                                return totalArea > 0 ? (finalPrice / totalArea).toFixed(2) : '0.00';
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* Botão Salvar */}
                        <div className="pt-4 -mx-6 -mb-6 px-6 py-4 bg-gray-50 border-t">
                          <button
                            onClick={handleSavePricing}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                          >
                            <Save className="w-5 h-5" />
                            Salvar Precificação
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Selecione um projeto
              </h3>
              <p className="text-gray-500">
                Selecione um projeto na lista ao lado ou crie um novo para começar
              </p>
            </div>
          )}
        </div>
      </div>

      {showRoomForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingRoom ? 'Editar Cômodo' : 'Novo Cômodo'}
              </h3>
              <button onClick={handleCancelRoom} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Cômodo *
                </label>
                <input
                  type="text"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Sala de Estar"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pavimento
                </label>
                <select
                  value={roomForm.floor_id}
                  onChange={(e) => setRoomForm({ ...roomForm, floor_id: e.target.value, floor: floors.find(f => f.id === e.target.value)?.name || '' })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um pavimento</option>
                  {floors.map(floor => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name}
                    </option>
                  ))}
                </select>
                {floors.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    Nenhum pavimento cadastrado. Adicione pavimentos no projeto primeiro.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lado A (metros) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={roomForm.side_a}
                    onChange={(e) => setRoomForm({ ...roomForm, side_a: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lado B (metros) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={roomForm.side_b}
                    onChange={(e) => setRoomForm({ ...roomForm, side_b: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Laje *
                </label>
                <select
                  value={roomForm.slab_type}
                  onChange={(e) => setRoomForm({ ...roomForm, slab_type: e.target.value as 'H8' | 'H12' })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="H8">H8</option>
                  <option value="H12">H12</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insumo
                </label>
                <select
                  value={roomForm.material_id}
                  onChange={(e) => setRoomForm({ ...roomForm, material_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um insumo</option>
                  {materials.map(material => (
                    <option key={material.id} value={material.id}>
                      {material.name} - R$ {material.unit_cost ? `${material.unit_cost.toFixed(2)}/${material.unit}` : (material.cost_per_meter ? `${material.cost_per_meter.toFixed(2)}/m` : '0.00')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fôrma *
                </label>
                <select
                  value={roomForm.mold_id}
                  onChange={(e) => setRoomForm({ ...roomForm, mold_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione uma fôrma</option>
                  {molds.map(mold => (
                    <option key={mold.id} value={mold.id}>
                      {mold.name} - Vol: {mold.reference_volume_m3} m³
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Traço
                </label>
                <select
                  value={roomForm.recipe_id}
                  onChange={(e) => setRoomForm({ ...roomForm, recipe_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um traço</option>
                  {recipes.map(recipe => (
                    <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={handleCancelRoom}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRoom}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                Salvar e Calcular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Reforço Estrutural */}
      {showReinforcementModal && pendingRoomData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-white" />
                <h2 className="text-xl font-bold text-white">Sugestão de Reforço Estrutural</h2>
              </div>
              <button
                onClick={() => setShowReinforcementModal(false)}
                className="text-white hover:bg-orange-800 p-2 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-orange-900 mb-1">Atenção: Vigota com comprimento superior a 3 metros!</p>
                    <p className="text-sm text-orange-800">
                      Este cômodo possui vigotas com <strong>{pendingRoomData.joist_length}m de comprimento</strong>.
                      Para garantir a segurança estrutural, recomendamos adicionar reforço com ferro de construção.
                    </p>
                    <p className="text-sm text-orange-800 mt-2">
                      O reforço será aplicado em <strong>todas as {pendingRoomData.joist_count} vigotas</strong> deste cômodo,
                      com o mesmo comprimento da vigota ({pendingRoomData.joist_length}m cada).
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Configuração do Reforço</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Material do Reforço <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={reinforcementForm.material_id}
                    onChange={(e) => setReinforcementForm({ ...reinforcementForm, material_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Selecione o insumo</option>
                    {materials.map(material => (
                      <option key={material.id} value={material.id}>
                        {material.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">Resumo do Reforço:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Quantidade: {pendingRoomData.joist_count} unidades</li>
                  <li>• Comprimento por unidade: {pendingRoomData.joist_length}m</li>
                  <li>• Comprimento total: {(pendingRoomData.joist_count * pendingRoomData.joist_length).toFixed(2)}m</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSkipReinforcement}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                >
                  Continuar sem Reforço
                </button>
                <button
                  onClick={handleConfirmReinforcement}
                  className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  Adicionar Reforço
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function RibbedSlabQuote(props: RibbedSlabQuoteProps) {
  return (
    <RibbedSlabQuoteErrorBoundary>
      <RibbedSlabQuoteInner {...props} />
    </RibbedSlabQuoteErrorBoundary>
  );
}