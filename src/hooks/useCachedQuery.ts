import { useEffect, useState, useCallback } from 'react';
import { useAppCache } from '../contexts/AppCacheContext';
import { supabase } from '../lib/supabase';

interface UseCachedQueryOptions {
  cacheKey: string;
  enabled?: boolean;
  dependencies?: any[];
}

export function useCachedQuery<T>(
  queryFn: () => Promise<T>,
  options: UseCachedQueryOptions
) {
  const { cacheKey, enabled = true, dependencies = [] } = options;
  const { getCache, setCache, setLoading, isLoading } = useAppCache();

  const [data, setData] = useState<T | null>(() => getCache<T>(cacheKey).data);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    const cached = getCache<T>(cacheKey);

    if (cached.data !== null) {
      setData(cached.data);
      return;
    }

    if (isLoading(cacheKey)) {
      return;
    }

    try {
      setLoading(cacheKey, true);
      setError(null);

      const result = await queryFn();

      setCache(cacheKey, result);
      setData(result);
    } catch (err) {
      console.error(`Error fetching ${cacheKey}:`, err);
      setError(err as Error);
    } finally {
      setLoading(cacheKey, false);
    }
  }, [cacheKey, enabled, queryFn, getCache, setCache, setLoading, isLoading, ...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    loading: isLoading(cacheKey),
    error,
    refetch,
  };
}

export function useCachedMaterials() {
  return useCachedQuery(
    async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, unit, brand, unit_cost, cost_per_meter, unit_length_meters, total_weight_kg, resale_enabled, resale_price, supplier_id, minimum_stock, ncm, cfop, csosn, import_status')
        .order('name')
        .limit(500);

      if (error) throw error;
      return data || [];
    },
    { cacheKey: 'materials' }
  );
}

export function useCachedProducts() {
  return useCachedQuery(
    async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, description, product_type, unit, recipe_id, reference_measurement, reference_volume, cement_weight, peso_artefato, material_cost, sale_price, recipes(id, name, concrete_type, specific_weight, moisture_percentage)')
        .order('name')
        .limit(500);

      if (error) throw error;
      return data || [];
    },
    { cacheKey: 'products' }
  );
}

export function useCachedRecipes() {
  return useCachedQuery(
    async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          id,
          name,
          concrete_type,
          specific_weight,
          moisture_percentage,
          created_at,
          products!inner(name, unit),
          recipe_items(
            id,
            quantity,
            materials(id, name, unit, unit_cost)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
    { cacheKey: 'recipes' }
  );
}

export function useCachedCompositions() {
  return useCachedQuery(
    async () => {
      const { data, error } = await supabase
        .from('compositions')
        .select(`
          id,
          name,
          description,
          unit,
          unit_cost,
          created_at,
          composition_items(
            id,
            quantity,
            item_type,
            material_id,
            product_id,
            materials(id, name, unit, unit_cost),
            products(id, name, unit)
          )
        `)
        .order('name')
        .limit(200);

      if (error) throw error;
      return data || [];
    },
    { cacheKey: 'compositions' }
  );
}

export function useCachedCustomers() {
  return useCachedQuery(
    async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, cpf, cnpj, person_type, address, city, state, cep')
        .order('name')
        .limit(500);

      if (error) throw error;
      return data || [];
    },
    { cacheKey: 'customers' }
  );
}

export function useCachedSuppliers() {
  return useCachedQuery(
    async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, cnpj, email, phone, address, city, state, cep')
        .order('name')
        .limit(200);

      if (error) throw error;
      return data || [];
    },
    { cacheKey: 'suppliers' }
  );
}
