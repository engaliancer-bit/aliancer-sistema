/*
  # Adicionar tipo de produto "Ferragens Diversas"

  1. Alterações
    - Adiciona novo tipo de produto: 'ferragens_diversas' ao constraint de product_type
    - Este tipo permite cadastrar produtos compostos apenas por insumos (ferro, solda, etc.)
    - Não utiliza traço de concreto, apenas materiais diretos

  2. Tipos de Produto Disponíveis
    - `artifact`: Artefatos de concreto convencionais
    - `premolded`: Produtos pré-moldados com fôrma e armaduras
    - `ferragens_diversas`: Ferragens e produtos diversos (ferro, solda, etc.) sem traço
*/

-- Remove o constraint antigo
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_product_type_check;

-- Adiciona o novo constraint com o tipo 'ferragens_diversas'
ALTER TABLE products
ADD CONSTRAINT products_product_type_check 
CHECK (product_type = ANY (ARRAY['artifact'::text, 'premolded'::text, 'ferragens_diversas'::text]));