/*
  # Alterar coluna quantity para aceitar valores decimais
  
  1. Alterações
    - Modifica a coluna `quantity` da tabela `quote_items` de INTEGER para NUMERIC(10,2)
    - Permite armazenar quantidades com até 2 casas decimais (ex: 0,4 ou 1,25)
    
  2. Segurança
    - Preserva todos os dados existentes (integer é conversível para numeric)
    - Não há perda de dados nesta alteração
*/

-- Alterar o tipo da coluna quantity de integer para numeric(10,2)
ALTER TABLE quote_items 
ALTER COLUMN quantity TYPE NUMERIC(10,2);