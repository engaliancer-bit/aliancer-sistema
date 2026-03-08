import React, { memo, useMemo, useCallback } from 'react';
import { Edit2, Trash2, Eye } from 'lucide-react';

interface OptimizedListItemProps {
  id: string;
  name: string;
  description?: string;
  value?: number;
  badge?: {
    text: string;
    color: string;
  };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
}

export const OptimizedListItem = memo(function OptimizedListItem({
  id,
  name,
  description,
  value,
  badge,
  onEdit,
  onDelete,
  onView,
}: OptimizedListItemProps) {
  const handleEdit = useCallback(() => {
    onEdit?.(id);
  }, [id, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete?.(id);
  }, [id, onDelete]);

  const handleView = useCallback(() => {
    onView?.(id);
  }, [id, onView]);

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-200">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900 truncate">{name}</h3>
          {badge && (
            <span className={`px-2 py-1 text-xs rounded-full ${badge.color}`}>
              {badge.text}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-gray-500 truncate mt-1">{description}</p>
        )}
        {value !== undefined && (
          <p className="text-sm font-medium text-gray-900 mt-1">
            R$ {value.toFixed(2)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 ml-4">
        {onView && (
          <button
            onClick={handleView}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
            aria-label="Visualizar"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        {onEdit && (
          <button
            onClick={handleEdit}
            className="p-2 text-amber-600 hover:bg-amber-50 rounded"
            aria-label="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded"
            aria-label="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
});

interface OptimizedInputProps {
  name: string;
  value: string | number;
  onChange: (name: string, value: string | number) => void;
  type?: 'text' | 'number' | 'email';
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export const OptimizedInput = memo(function OptimizedInput({
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  label,
  error,
  disabled,
}: OptimizedInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
      onChange(name, newValue);
    },
    [name, onChange, type]
  );

  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});

interface OptimizedSelectProps {
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export const OptimizedSelect = memo(function OptimizedSelect({
  name,
  value,
  onChange,
  options,
  label,
  error,
  disabled,
}: OptimizedSelectProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(name, e.target.value);
    },
    [name, onChange]
  );

  const memoizedOptions = useMemo(
    () =>
      options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      )),
    [options]
  );

  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        name={name}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      >
        {memoizedOptions}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});

interface OptimizedCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
}

export const OptimizedCard = memo(function OptimizedCard({
  title,
  value,
  subtitle,
  icon,
  color = 'bg-blue-500',
  onClick,
}: OptimizedCardProps) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`p-3 rounded-full ${color}`}>
            <div className="text-white">{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
});

interface OptimizedButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export const OptimizedButton = memo(function OptimizedButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  loading,
  fullWidth,
}: OptimizedButtonProps) {
  const colorClasses = useMemo(() => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'secondary':
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  }, [variant]);

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${colorClasses} ${
        fullWidth ? 'w-full' : ''
      } ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          <span className="ml-2">Processando...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
});
