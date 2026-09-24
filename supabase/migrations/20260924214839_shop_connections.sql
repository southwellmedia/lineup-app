-- Third-party tags a shop can add to its website: Google Analytics 4, a Meta
-- Pixel and Google Search Console verification. The values end up in the
-- site's HTML, so the formats are strict here as well as in the API.
ALTER TABLE public.shops
  ADD COLUMN ga4_measurement_id text CHECK (ga4_measurement_id ~ '^G-[A-Z0-9]{6,12}$'),
  ADD COLUMN meta_pixel_id text CHECK (meta_pixel_id ~ '^[0-9]{10,20}$'),
  ADD COLUMN google_site_verification text
    CHECK (google_site_verification ~ '^[A-Za-z0-9_-]{20,100}$');
