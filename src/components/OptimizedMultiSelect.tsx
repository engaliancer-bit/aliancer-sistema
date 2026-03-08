import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useMultiSelect } from '../hooks/useOptimizedSelect';

interface Option {
  id: string | number;
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface OptimizedMultiSelectProps {
  options: Option[];
  value?: (string | number)[];
  onChange: (values: (string | number)[]) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  maxSelections?: number;
  renderOption?: (option: Option) => React.ReactNode;
  renderSelected?: (options: Option[]) => React.ReactNode;
  threshold?: number;
  pageSize?: number;
  emptyMessage?: string;
  maxSelectedDisplay?: number;
}

export default function OptimizedMultiSelect({
  options,
  value = [],
  onChange,
  placeholder = 'Selecione...',
  searchable = true,
  disabled = false,
  className = '',
  name,
  maxSelections,
  renderOption,
  renderSelected,
  threshold = 50,
  pageSize = 20,
  emptyMessage = 'Nenhuma opção encontrada',
  maxSelectedDisplay = 3,
}: OptimizedMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Multi-select hook
  const selectedOptions = useMemo(() => {
    return options.filter((opt) => value.includes(opt.value));
  }, [options, value]);

  const selectedValues = useMemo(() => new Set(value), [value]);

  // Filtrar opções baseado na busca
  const filteredOptions = useMemo(() => {
    if (!debouncedSearch) return options;

    const lowerSearch = debouncedSearch.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(lowerSearch)
    );
  }, [options, debouncedSearch]);

  // Opções visíveis (lazy loading)
  const visibleOptions = useMemo(() => {
    if (filteredOptions.length <= threshold) {
      return filteredOptions;
    }
    return filteredOptions.slice(0, visibleCount);
  }, [filteredOptions, visibleCount, threshold]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focar input de busca ao abrir
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Resetar ao fechar
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setVisibleCount(pageSize);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [isOpen, pageSize]);

  // Lazy loading ao fazer scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

      if (
        scrollHeight - scrollTop - clientHeight < 100 &&
        visibleCount < filteredOptions.length
      ) {
        setVisibleCount((prev) => Math.min(prev + pageSize, filteredOptions.length));
      }
    },
    [visibleCount, filteredOptions.length, pageSize]
  );

  const handleToggle = useCallback(
    (optionValue: string | number) => {
      const isSelected = selectedValues.has(optionValue);

      let newValues: (string | number)[];
      if (isSelected) {
        newValues = value.filter((v) => v !== optionValue);
      } else {
        if (maxSelections && value.length >= maxSelections) {
          return;
        }
        newValues = [...value, optionValue];
      }

      onChange(newValues);
    },
    [value, selectedValues, maxSelections, onChange]
  );

  const handleRemove = useCallback(
    (optionValue: string | number) => {
      onChange(value.filter((v) => v !== optionValue));
    },
    [value, onChange]
  );

  const handleClearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange]
  );

  const handleToggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  // Renderizar display de selecionados
  const renderSelectedDisplay = () => {
    if (selectedOptions.length === 0) {
      return <span className="text-gray-400">{placeholder}</span>;
    }

    if (renderSelected) {
      return renderSelected(selectedOptions);
    }

    if (selectedOptions.length <= maxSelectedDisplay) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-sm"
            >
              {option.label}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(option.value);
                }}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      );
    }

    return (
      <span className="text-gray-900">
        {selectedOptions.length} {selectedOptions.length === 1 ? 'item selecionado' : 'itens selecionados'}
      </span>
    );
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Select display */}
      <button
        type="button"
        className={`w-full px-3 py-2 text-left bg-white border rounded-lg shadow-sm transition-colors ${
          disabled
            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
            : 'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
        } ${isOpen ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'}`}
        onClick={handleToggleDropdown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-multiselectable="true"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">{renderSelectedDisplay()}</div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {selectedOptions.length > 0 && !disabled && (
              <X
                className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={handleClearAll}
              />
            )}
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isOpen ? 'transform rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </button>

      {/* Hidden inputs for form submission */}
      {name &&
        value.map((val, index) => (
          <input key={index} type="hidden" name={`${name}[]`} value={val} />
        ))}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          {/* Search input */}
          {searchable && (
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Selected count */}
          {selectedOptions.length > 0 && (
            <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-700">
              <div className="flex items-center justify-between">
                <span>
                  {selectedOptions.length} {selectedOptions.length === 1 ? 'selecionado' : 'selecionados'}
                  {maxSelections && ` (máx: ${maxSelections})`}
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-blue-600 hover:text-blue-800 text-xs underline"
                >
                  Limpar tudo
                </button>
              </div>
            </div>
          )}

          {/* Options list */}
          <div
            ref={scrollContainerRef}
            className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
            onScroll={handleScroll}
            role="listbox"
            aria-multiselectable="true"
          >
            {visibleOptions.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              <>
                {visibleOptions.map((option) => {
                  const isSelected = selectedValues.has(option.value);
                  const isDisabled =
                    option.disabled ||
                    (maxSelections !== undefined &&
                      !isSelected &&
                      selectedValues.size >= maxSelections);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                        isDisabled
                          ? 'text-gray-400 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => !isDisabled && handleToggle(option.value)}
                      disabled={isDisabled}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="flex-1">
                        {renderOption ? renderOption(option) : option.label}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}

                {/* Loading indicator */}
                {visibleCount < filteredOptions.length && (
                  <div className="px-3 py-2 text-center text-xs text-gray-500">
                    Carregando mais opções... ({visibleCount}/{filteredOptions.length})
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer info */}
          {filteredOptions.length > threshold && (
            <div className="px-3 py-2 border-t border-gray-200 text-xs text-gray-500 bg-gray-50">
              <div className="flex items-center justify-between">
                <span>
                  Exibindo {visibleCount} de {filteredOptions.length} opções
                </span>
                <span className="text-blue-600">⚡ Lazy loading ativo</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
