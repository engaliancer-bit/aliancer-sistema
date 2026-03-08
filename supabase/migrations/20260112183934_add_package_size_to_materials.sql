/*
  # Adicionar tamanho de embalagem aos materiais

  1. Alteracoes
    - Adiciona campo `package_size` na tabela materials
      - Armazena o peso/volume da embalagem do insumo
      - Exemplo: Um tambor de 200kg, uma lata de 18L, um saco de 50kg
    
  2. Funcionalidade
    - Permite calcular o custo unitário real baseado no tamanho da embalagem
    - Exemplo: Comprou 1 tambor de 200kg por R$ 200,00 = R$ 1,00 por kg
    
  3. Notas
    - O campo `unit_price` continua sendo o preço por unidade de medida (kg, L, etc)
    - O campo `package_size` indica quantas unidades vêm na embalagem
    - Custo unitário = price / package_size (se package_size > 0)
*/

-- Adicionar campo de tamanho de embalagem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'package_size'
  ) THEN
    ALTER TABLE materials ADD COLUMN package_size numeric DEFAULT 1 CHECK (package_size > 0);
    COMMENT ON COLUMN materials.package_size IS 'Peso ou volume da embalagem (ex: 200 para tambor de 200kg)';
  END IF;
END $$;