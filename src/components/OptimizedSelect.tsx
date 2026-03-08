import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';

interface Option {
  id: string | number;
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface OptimizedSelectProps {
  options: Option[];
  value?: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  required?: boolean;
  renderOption?: (option: Option) => React.ReactNode;
  threshold?: number;
  pageSize?: number;
  emptyMessage?: string;
}

export default function OptimizedSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  searchable = false,
  clearable = false,
  disabled = false,
  className = '',
  name,
  required = false,
  renderOption,
  threshold = 50,
  pageSize = 20,
  emptyMessage = 'Nenhuma opção encontrada',
}: OptimizedSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const debouncedSearch = useDebounce(searchTerm, 300);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Opção selecionada
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
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

  // Resetar scroll e visibleCount ao fechar
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

      // Carregar mais quando estiver próximo do fim
      if (
        scrollHeight - scrollTop - clientHeight < 100 &&
        visibleCount < filteredOptions.length
      ) {
        setVisibleCount((prev) => Math.min(prev + pageSize, filteredOptions.length));
      }
    },
    [visibleCount, filteredOptions.length, pageSize]
  );

  const handleSelect = useCallback(
    (optionValue: string | number) => {
      onChange(optionValue);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
      setSearchTerm('');
    },
    [onChange]
  );

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

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
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-900'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {clearable && selectedOption && !disabled && (
              <X
                className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={handleClear}
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

      {/* Hidden input for form submission */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value || ''}
          required={required}
        />
      )}

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

          {/* Options list */}
          <div
            ref={scrollContainerRef}
            className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
            onScroll={handleScroll}
            role="listbox"
          >
            {visibleOptions.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              <>
                {visibleOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                        option.disabled
                          ? 'text-gray-400 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                      onClick={() => !option.disabled && handleSelect(option.value)}
                      disabled={option.disabled}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {renderOption ? renderOption(option) : option.label}
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

// Hook para criar opções a partir de array de objetos
export function useSelectOptions<T extends Record<string, any>>(
  items: T[],
  labelKey: keyof T,
  valueKey: keyof T,
  disabledKey?: keyof T
): Option[] {
  return useMemo(() => {
    return items.map((item) => ({
      id: item[valueKey] as string | number,
      label: String(item[labelKey]),
      value: item[valueKey] as string | number,
      disabled: disabledKey ? Boolean(item[disabledKey]) : false,
    }));
  }, [items, labelKey, valueKey, disabledKey]);
}

// Select otimizado nativo (fallback para formulários simples)
interface NativeOptimizedSelectProps {
  options: Option[];
  value?: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
  required?: boolean;
}

export function NativeOptimizedSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  disabled = false,
  className = '',
  name,
  required = false,
}: NativeOptimizedSelectProps) {
  return (
    <select
      className={`w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 ${className}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      name={name}
      required={required}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}
