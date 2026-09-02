-- Normalize historical phone formatting so new writes can compare one canonical value.
UPDATE clients
SET phone = replace(
  replace(
    replace(
      replace(
        replace(
          replace(phone, '(', ''),
        ')', ''),
      '-', ''),
    ' ', ''),
  '.', ''),
'+', '')
WHERE phone <> '';

-- Remove the Brazilian country code when a domestic 10/11 digit number was stored with +55.
UPDATE clients
SET phone = substr(phone, 3)
WHERE substr(phone, 1, 2) = '55'
  AND length(phone) IN (12, 13);

-- Historical placeholder values mean "no phone" and must not participate in uniqueness.
UPDATE clients
SET phone = ''
WHERE phone IN ('0000000000', '00000000000');

-- Keep historical duplicates intact, but block every new duplicate atomically at write time.
CREATE TRIGGER clients_phone_unique_insert
BEFORE INSERT ON clients
WHEN NEW.phone <> ''
  AND EXISTS (
    SELECT 1
    FROM clients
    WHERE business_id = NEW.business_id
      AND phone = NEW.phone
  )
BEGIN
  SELECT RAISE(ABORT, 'CLIENT_PHONE_DUPLICATE');
END;

CREATE TRIGGER clients_phone_unique_update
BEFORE UPDATE OF phone ON clients
WHEN NEW.phone <> ''
  AND NEW.phone <> OLD.phone
  AND EXISTS (
    SELECT 1
    FROM clients
    WHERE business_id = NEW.business_id
      AND phone = NEW.phone
      AND id <> NEW.id
  )
BEGIN
  SELECT RAISE(ABORT, 'CLIENT_PHONE_DUPLICATE');
END;
