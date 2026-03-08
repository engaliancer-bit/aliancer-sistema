import React, { useMemo } from 'react';

interface ProductionCostDetail {
  production_id: string;
  product_name: string;
  quantity: number;
  date: string;
  material_cost: number;
  labor_cost: number;
  indirect_cost: number;
  depreciation_cost: number;
  total_cost: number;
  cost_per_unit: number;
}

interface ProductionCostsTableProps {
  costDetails: ProductionCostDetail[];
  totalMaterialCost: number;
  totalLaborCost: number;
  totalIndirectCost: number;
  totalDepreciationCost: number;
  grandTotal: number;
  averageCostPerUnit: number;
}

const TableRow = React.memo(({ detail }: { detail: ProductionCostDetail }) => (
  <tr className="hover:bg-gray-50">
    <td className="px-6 py-4 text-sm text-gray-900">
      {new Date(detail.date).toLocaleDateString('pt-BR')}
    </td>
    <td className="px-6 py-4 text-sm text-gray-900">
      {detail.product_name}
    </td>
    <td className="px-6 py-4 text-sm text-right text-gray-900">
      {detail.quantity}
    </td>
    <td className="px-6 py-4 text-sm text-right text-blue-600">
      R$ {detail.material_cost.toFixed(2)}
    </td>
    <td className="px-6 py-4 text-sm text-right text-green-600">
      R$ {detail.labor_cost.toFixed(2)}
    </td>
    <td className="px-6 py-4 text-sm text-right text-orange-600">
      R$ {detail.indirect_cost.toFixed(2)}
    </td>
    <td className="px-6 py-4 text-sm text-right text-purple-600">
      R$ {detail.depreciation_cost.toFixed(2)}
    </td>
    <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
      R$ {detail.total_cost.toFixed(2)}
    </td>
    <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">
      R$ {detail.cost_per_unit.toFixed(4)}
    </td>
  </tr>
));

TableRow.displayName = 'TableRow';

const ProductionCostsTable = React.memo((props: ProductionCostsTableProps) => {
  const visibleRows = useMemo(
    () => props.costDetails.map(detail => (
      <TableRow key={detail.production_id} detail={detail} />
    )),
    [props.costDetails]
  );

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Produto
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Quantidade
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Materiais
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Mão de Obra
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Indiretos
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Depreciação
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Custo/Un
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visibleRows}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td colSpan={3} className="px-6 py-4 text-sm text-gray-900">
                TOTAL
              </td>
              <td className="px-6 py-4 text-sm text-right text-blue-600">
                R$ {props.totalMaterialCost.toFixed(2)}
              </td>
              <td className="px-6 py-4 text-sm text-right text-green-600">
                R$ {props.totalLaborCost.toFixed(2)}
              </td>
              <td className="px-6 py-4 text-sm text-right text-orange-600">
                R$ {props.totalIndirectCost.toFixed(2)}
              </td>
              <td className="px-6 py-4 text-sm text-right text-purple-600">
                R$ {props.totalDepreciationCost.toFixed(2)}
              </td>
              <td className="px-6 py-4 text-sm text-right text-gray-900">
                R$ {props.grandTotal.toFixed(2)}
              </td>
              <td className="px-6 py-4 text-sm text-right text-blue-600">
                R$ {props.averageCostPerUnit.toFixed(4)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
});

ProductionCostsTable.displayName = 'ProductionCostsTable';

export default ProductionCostsTable;
