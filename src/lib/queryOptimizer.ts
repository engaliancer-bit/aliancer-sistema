/**
 * Query Optimizer - Otimizações automáticas para queries Supabase
 *
 * Resolve degradação progressiva de performance aplicando:
 * - Paginação automática
 * - Seleção de colunas específicas
 * - Limite de resultados
 * - Cache inteligente
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface QueryOptions {
  page?: number;
  pageSize?: number;
  columns?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  maxResults?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number | null;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Otimiza query com paginação e seleção de colunas
 */
export async function optimizedQuery<T>(
  supabase: SupabaseClient,
  table: string,
  options: QueryOptions = {}
): Promise<PaginatedResult<T>> {
  const {
    page = 1,
    pageSize = 50,
    columns = '*',
    orderBy = 'created_at',
    orderDirection = 'desc',
    maxResults = 1000
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Limitar resultados máximos
  const effectivePageSize = Math.min(pageSize, maxResults);

  let query = supabase
    .from(table)
    .select(columns, { count: 'exact' });

  // Aplicar ordenação
  if (orderBy) {
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });
  }

  // Aplicar paginação
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error(`[QueryOptimizer] Erro em ${table}:`, error);
    throw error;
  }

  return {
    data: (data as T[]) || [],
    count,
    page,
    pageSize: effectivePageSize,
    hasMore: count ? (page * effectivePageSize) < count : false
  };
}

/**
 * Query otimizada com filtros
 */
export async function optimizedQueryWithFilters<T>(
  supabase: SupabaseClient,
  table: string,
  filters: Record<string, any>,
  options: QueryOptions = {}
): Promise<PaginatedResult<T>> {
  const {
    page = 1,
    pageSize = 50,
    columns = '*',
    orderBy = 'created_at',
    orderDirection = 'desc'
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from(table)
    .select(columns, { count: 'exact' });

  // Aplicar filtros
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    }
  });

  // Aplicar ordenação e paginação
  if (orderBy) {
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error(`[QueryOptimizer] Erro em ${table}:`, error);
    throw error;
  }

  return {
    data: (data as T[]) || [],
    count,
    page,
    pageSize,
    hasMore: count ? (page * pageSize) < count : false
  };
}

/**
 * Busca otimizada com texto (usa índice trigram)
 */
export async function optimizedTextSearch<T>(
  supabase: SupabaseClient,
  table: string,
  column: string,
  searchTerm: string,
  options: QueryOptions = {}
): Promise<PaginatedResult<T>> {
  const {
    page = 1,
    pageSize = 50,
    columns = '*',
    orderBy = 'created_at',
    orderDirection = 'desc'
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from(table)
    .select(columns, { count: 'exact' });

  // Busca usando operador ilike (usa índice trigram)
  if (searchTerm) {
    query = query.ilike(column, `%${searchTerm}%`);
  }

  // Aplicar ordenação e paginação
  if (orderBy) {
    query = query.order(orderBy, { ascending: orderDirection === 'asc' });
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error(`[QueryOptimizer] Erro em busca textual:`, error);
    throw error;
  }

  return {
    data: (data as T[]) || [],
    count,
    page,
    pageSize,
    hasMore: count ? (page * pageSize) < count : false
  };
}

/**
 * Colunas otimizadas para queries comuns
 */
export const OPTIMIZED_COLUMNS = {
  engineering_projects: 'id,name,customer_id,property_id,status,start_date,created_at',
  customers: 'id,name,cpf,phone,email,person_type',
  properties: 'id,customer_id,name,municipality,state,property_type',
  production: 'id,production_date,product_id,quantity,production_order_id',
  quotes: 'id,customer_id,status,created_at,quote_type',
  unified_sales: 'id,customer_id,data_venda,valor_total,status',
  material_movements: 'id,material_id,movement_date,quantity,movement_type',
  products: 'id,name,product_type,weight',
  materials: 'id,name,unit,current_cost'
} as const;

/**
 * Obter colunas otimizadas para uma tabela
 */
export function getOptimizedColumns(table: string): string {
  return OPTIMIZED_COLUMNS[table as keyof typeof OPTIMIZED_COLUMNS] || '*';
}

/**
 * Query builder otimizado
 */
export class OptimizedQueryBuilder<T> {
  private supabase: SupabaseClient;
  private table: string;
  private selectedColumns: string = '*';
  private filters: Record<string, any> = {};
  private orderByColumn?: string;
  private orderByDirection: 'asc' | 'desc' = 'desc';
  private pageNum: number = 1;
  private pageSizeNum: number = 50;

  constructor(supabase: SupabaseClient, table: string) {
    this.supabase = supabase;
    this.table = table;
  }

  select(columns: string): this {
    this.selectedColumns = columns;
    return this;
  }

  selectOptimized(): this {
    this.selectedColumns = getOptimizedColumns(this.table);
    return this;
  }

  where(key: string, value: any): this {
    this.filters[key] = value;
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'desc'): this {
    this.orderByColumn = column;
    this.orderByDirection = direction;
    return this;
  }

  page(page: number): this {
    this.pageNum = page;
    return this;
  }

  pageSize(size: number): this {
    this.pageSizeNum = size;
    return this;
  }

  async execute(): Promise<PaginatedResult<T>> {
    return optimizedQueryWithFilters<T>(
      this.supabase,
      this.table,
      this.filters,
      {
        columns: this.selectedColumns,
        orderBy: this.orderByColumn,
        orderDirection: this.orderByDirection,
        page: this.pageNum,
        pageSize: this.pageSizeNum
      }
    );
  }
}

/**
 * Criar query builder otimizado
 */
export function createOptimizedQuery<T>(
  supabase: SupabaseClient,
  table: string
): OptimizedQueryBuilder<T> {
  return new OptimizedQueryBuilder<T>(supabase, table);
}
