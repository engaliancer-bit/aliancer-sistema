import { useState, useMemo } from 'react';

export interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export interface PaginationControls {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
  range: { from: number; to: number };
}

export function usePagination(totalItems: number, defaultPageSize: number = 50): PaginationControls {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const canGoNext = currentPage < totalPages;
  const canGoPrevious = currentPage > 1;

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (canGoNext) setCurrentPage(currentPage + 1);
  };

  const previousPage = () => {
    if (canGoPrevious) setCurrentPage(currentPage - 1);
  };

  const handleSetPageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const range = useMemo(() => ({
    from: startIndex,
    to: endIndex - 1
  }), [startIndex, endIndex]);

  return {
    currentPage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    canGoNext,
    canGoPrevious,
    goToPage,
    nextPage,
    previousPage,
    setPageSize: handleSetPageSize,
    range
  };
}
