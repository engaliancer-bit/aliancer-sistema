import { useState, useCallback } from 'react';
import { Package, FileDown, Search } from 'lucide-react';
import { ProductsList, ProductListItem } from './ProductsList';
import { ProductsPagination } from './ProductsPagination';
import { useProductsData } from '../../hooks/useProductsData';

export default function ProductsContainer() {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(null);

  const {
    products,
    loading,
    totalCount,
    currentPage,
    totalPages,
    searchTerm,
    setSearchTerm,
    goToPage,
    nextPage,
    prevPage,
    refetch,
  } = useProductsData({
    pageSize: 50,
    staleTime: 600000,
  });

  const handleEdit = useCallback((product: ProductListItem) => {
    setEditingProduct(product);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este produto?')) {
      return;
    }

    try {
      console.log('Deletando produto:', id);
      await refetch();
    } catch (error) {
      console.error('Erro ao deletar produto:', error);
    }
  }, [refetch]);

  const handleClone = useCallback((product: ProductListItem) => {
    console.log('Clonando produto:', product);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingProduct(null);
    refetch();
  }, [refetch]);

  const handleExportPDF = useCallback(() => {
    console.log('Exportando PDF...');
  }, []);

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">
            {editingProduct ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button
            onClick={handleFormClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Voltar para Lista
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600">
            Formulário de produto será integrado aqui. Produto selecionado: {editingProduct?.name || 'Novo'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="w-8 h-8 text-blue-600" />
          Produtos
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Novo Produto
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FileDown className="w-5 h-5" />
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Pesquisar produtos por nome, código ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {searchTerm && (
          <div className="mt-2 text-sm text-gray-600">
            {totalCount} produto(s) encontrado(s)
          </div>
        )}
      </div>

      <ProductsList
        products={products}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClone={handleClone}
        loading={loading}
      />

      <ProductsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        onPrevPage={prevPage}
        onNextPage={nextPage}
        onGoToPage={goToPage}
      />
    </div>
  );
}
