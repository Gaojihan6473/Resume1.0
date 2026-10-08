-- Keep existing batches visually unchanged; selections sync across devices.
alter table public.recruitment_batches
  add column card_style text not null default 'none'
  constraint recruitment_batches_card_style_check check (card_style in (
    'none', 'cloud-voyage', 'forest-letter', 'moon-garden', 'sunlit-studio',
    'ocean-postcard', 'paper-mountains', 'city-window', 'cosmic-drift',
    'spring-bloom', 'kite-day', 'quiet-pond', 'golden-orchard',
    'rainbow-path', 'little-lighthouse', 'butterfly-notes'
  ));
comment on column public.recruitment_batches.card_style is 'Optional decorative illustration; theme color remains independent.';
notify pgrst, 'reload schema';
