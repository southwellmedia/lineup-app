-- What a shop's website and booking page show about it: contact details,
-- address and a short pitch. All optional.

ALTER TABLE public.shops
  ADD COLUMN tagline text CHECK (length(tagline) <= 120),
  ADD COLUMN about text CHECK (length(about) <= 2000),
  ADD COLUMN phone text CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  ADD COLUMN email text CHECK (length(email) <= 254),
  -- Handle without the @.
  ADD COLUMN instagram text CHECK (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  ADD COLUMN address_line text CHECK (length(address_line) <= 200),
  ADD COLUMN city text CHECK (length(city) <= 100),
  ADD COLUMN region text CHECK (length(region) <= 100),
  ADD COLUMN postal_code text CHECK (length(postal_code) <= 20),
  -- Neighborhood for local SEO copy ("Barbershop in Oak Cliff").
  ADD COLUMN neighborhood text CHECK (length(neighborhood) <= 100);
