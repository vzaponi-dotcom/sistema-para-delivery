ALTER TABLE products ADD COLUMN presentation_type TEXT NOT NULL DEFAULT 'unit';
ALTER TABLE products ADD COLUMN presentation_value TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN presentation_unit TEXT NOT NULL DEFAULT '';

UPDATE products
SET category = CASE category
  WHEN 'Marmita' THEN 'Refeições'
  WHEN 'Bebida' THEN 'Bebidas'
  WHEN 'Doce' THEN 'Sobremesas'
  WHEN 'Adicional' THEN 'Adicionais'
  ELSE category
END;

UPDATE products
SET presentation_type = CASE
      WHEN trim(size) = '' OR size IN ('Un', 'Unidade') THEN 'unit'
      ELSE 'size'
    END,
    presentation_value = CASE
      WHEN trim(size) = '' OR size IN ('Un', 'Unidade') THEN ''
      ELSE size
    END,
    presentation_unit = '';
