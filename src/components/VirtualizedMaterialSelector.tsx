import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Search, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDebounce } from '../hooks/useDebounce';

interface Material {
  id: string;
  name: string;
  unit: string;
  unit_cost?: number;
  resale_enabled?: boolean;
}

interface VirtualizedMaterialSelectorProps {
  value: string;
  selectedMaterialId?: string;
  onSelect: (material: Material) => void;
  onClear: () => void;
  placeholder?: string;
  preloadedMaterials?: Material[];
  preloadedLoading?: boolean;
}

let moduleCache: Material[] | null = null;

function highlightMatch(text: string, term: string) {
  if (!term.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5 font-semibold not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function VirtualizedMaterialSelector({
  value,
  selectedMaterialId,
  onSelect,
  onClear,
  placeholder = 'Buscar insumo...',
  preloadedMaterials,
  preloadedLoading = false,
}: VirtualizedMaterialSelectorProps) {
  const usePreloaded = preloadedMaterials !== undefined;

  const [results, setResults] = useState<Material[]>(() => {
    if (usePreloaded) return preloadedMaterials;
    return moduleCache ?? [];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 250);

  useEffect(() => {
    if (usePreloaded) {
      const materials = preloadedMaterials ?? [];
      const term = debouncedSearch.trim().toLowerCase();
      if (!term) {
        setResults(materials);
      } else {
        setResults(materials.filter(m => m.name.toLowerCase().includes(term)));
      }
      return;
    }

    const term = debouncedSearch.trim();

    if (!term) {
      if (moduleCache) {
        setResults(moduleCache);
        setSearching(false);
        return;
      }
      setSearching(true);
      supabase
        .from('materials')
        .select('id, name, unit, unit_cost, resale_enabled')
        .order('name')
        .limit(200)
        .then(({ data, error }) => {
          if (error) { moduleCache = null; setSearching(false); return; }
          const list = data ?? [];
          moduleCache = list;
          setResults(list);
          setSearching(false);
        });
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);

    supabase
      .from('materials')
      .select('id, name, unit, unit_cost, resale_enabled')
      .ilike('name', `%${term}%`)
      .order('name')
      .limit(100)
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (error || controller.signal.aborted) return;
        setResults(data ?? []);
        setSearching(false);
      });
  }, [debouncedSearch, usePreloaded, preloadedMaterials]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((material: Material) => {
    onSelect(material);
    setIsOpen(false);
    setSearchTerm('');
  }, [onSelect]);

  const handleClear = useCallback(() => {
    onClear();
    setSearchTerm('');
    setIsOpen(false);
  }, [onClear]);

  const isLoading = usePreloaded ? preloadedLoading : searching;
  const isSearching = debouncedSearch.trim().length > 0;

  const ITEM_HEIGHT = 72;

  const VirtualRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const material = results[index];
    const isSelected = material.id === selectedMaterialId;

    return (
      <div
        style={style}
        onClick={() => handleSelect(material)}
        className={`px-4 py-2 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors flex items-start gap-3 ${isSelected ? 'bg-blue-50 border-l-2 border-l-[#0A7EC2]' : ''}`}
      >
        <Package className={`w-4 h-4 mt-1 flex-shrink-0 ${isSelected ? 'text-[#0A7EC2]' : 'text-gray-300'}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm leading-snug ${isSelected ? 'font-semibold text-[#0A7EC2]' : 'font-medium text-gray-900'}`}>
            {material.name}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
              {material.unit}
            </span>
            {material.unit_cost != null && material.unit_cost > 0 && (
              <span className="text-xs text-gray-500">
                R$ {material.unit_cost.toFixed(2)}
              </span>
            )}
            {material.resale_enabled && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                Revenda
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }, [results, selectedMaterialId, handleSelect]);

  const SearchResults = useMemo(() => {
    return results.map((material) => {
      const isSelected = material.id === selectedMaterialId;
      return (
        <div
          key={material.id}
          onClick={() => handleSelect(material)}
          className={`px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors flex items-start gap-3 ${isSelected ? 'bg-blue-50 border-l-2 border-l-[#0A7EC2]' : ''}`}
        >
          <Package className={`w-4 h-4 mt-1 flex-shrink-0 ${isSelected ? 'text-[#0A7EC2]' : 'text-gray-300'}`} />
          <div className="flex-1 min-w-0">
            <div className={`text-sm leading-snug break-words ${isSelected ? 'font-semibold text-[#0A7EC2]' : 'font-medium text-gray-900'}`}>
              {highlightMatch(material.name, debouncedSearch)}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                {material.unit}
              </span>
              {material.unit_cost != null && material.unit_cost > 0 && (
                <span className="text-xs text-gray-500">
                  R$ {material.unit_cost.toFixed(2)}
                </span>
              )}
              {material.resale_enabled && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                  Revenda
                </span>
              )}
            </div>
          </div>
        </div>
      );
    });
  }, [results, selectedMaterialId, debouncedSearch, handleSelect]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={isOpen ? searchTerm : (searchTerm || value)}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setSearchTerm('');
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A7EC2] focus:border-transparent text-sm"
        />
        {value && !searchTerm && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        )}
        {(isLoading || (searchTerm && searching)) && (
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-[#0A7EC2] rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
          style={{ minWidth: '560px', width: 'max-content', maxWidth: '780px' }}
        >
          {isLoading && results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-[#0A7EC2] rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Carregando insumos...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhum insumo encontrado</p>
              {debouncedSearch && (
                <p className="text-xs text-gray-400 mt-1">Tente uma busca diferente</p>
              )}
            </div>
          ) : (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                <span>
                  {isSearching
                    ? <><span className="font-medium text-gray-700">{results.length}</span> {results.length === 1 ? 'resultado' : 'resultados'} para <span className="font-medium text-gray-700">"{debouncedSearch}"</span></>
                    : <><span className="font-medium text-gray-700">{results.length}</span> {results.length === 1 ? 'insumo' : 'insumos'} disponíveis</>
                  }
                </span>
                {searching && (
                  <div className="w-3 h-3 border-2 border-gray-300 border-t-[#0A7EC2] rounded-full animate-spin" />
                )}
              </div>

              {isSearching ? (
                <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
                  {SearchResults}
                </div>
              ) : (
                <List
                  height={Math.min(results.length * ITEM_HEIGHT, 420)}
                  itemCount={results.length}
                  itemSize={ITEM_HEIGHT}
                  width="100%"
                >
                  {VirtualRow}
                </List>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
