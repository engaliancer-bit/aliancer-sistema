import { memo } from 'react';

interface SkeletonLoaderProps {
  type?: 'form' | 'table' | 'card' | 'list';
  rows?: number;
  className?: string;
}

export const SkeletonLoader = memo(({ type = 'form', rows = 3, className = '' }: SkeletonLoaderProps) => {
  const baseClasses = 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] rounded';

  if (type === 'form') {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className={`${baseClasses} h-4 w-24`} />
            <div className={`${baseClasses} h-10 w-full`} />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${baseClasses} h-10 flex-1`} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className={`${baseClasses} h-12 flex-1`} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`${baseClasses} h-32 w-full`} />
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`${baseClasses} h-10 w-10 rounded-full`} />
            <div className="flex-1 space-y-2">
              <div className={`${baseClasses} h-4 w-3/4`} />
              <div className={`${baseClasses} h-3 w-1/2`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
});

SkeletonLoader.displayName = 'SkeletonLoader';

interface FormSkeletonProps {
  fields?: number;
}

export const FormSkeleton = memo(({ fields = 5 }: FormSkeletonProps) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="animate-pulse bg-gray-200 h-8 w-48 rounded" />
      <SkeletonLoader type="form" rows={fields} />
      <div className="flex gap-3 pt-4">
        <div className="animate-pulse bg-gray-200 h-10 w-32 rounded" />
        <div className="animate-pulse bg-gray-200 h-10 w-24 rounded" />
      </div>
    </div>
  );
});

FormSkeleton.displayName = 'FormSkeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton = memo(({ rows = 5 }: TableSkeletonProps) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <div className="animate-pulse bg-gray-200 h-8 w-64 rounded" />
      </div>
      <SkeletonLoader type="table" rows={rows} />
    </div>
  );
});

TableSkeleton.displayName = 'TableSkeleton';
