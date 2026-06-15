type StrapiInstance = {
  db: {
    query: (uid: string) => {
      findMany: (params?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
      update: (params: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => Promise<unknown>;
    };
  };
  log: {
    info: (message: string) => void;
  };
};

const BUTTON_VARIANTS = new Set(['contained', 'outlined', 'text']);
const BUTTON_COLORS = new Set(['green', 'dark_blue', 'white', 'black']);
const BUTTON_ACTIONS = new Set(['whatsapp', 'contact_form']);
const ICON_POSITIONS = new Set(['start', 'end']);
const BADGE_VARIANTS = new Set(['light', 'dark']);
const BANNER_VARIANTS = new Set(['dark', 'light', 'note', 'transparent']);
const IMAGE_RADIUS_VALUES = new Set([
  'none',
  'sm',
  'md',
  'lg',
  'xl',
  'xl2',
  'xl3',
  'full',
]);

function normalizeButtonVariant(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const key = value.trim().toLowerCase();

  if (key === 'contained' || key === 'primary' || key === 'solid' || key === 'filled') {
    return 'contained';
  }

  if (key === 'outlined' || key === 'outline' || key === 'secondary') {
    return 'outlined';
  }

  if (key === 'text' || key === 'ghost' || key === 'link') {
    return 'text';
  }

  return BUTTON_VARIANTS.has(key) ? key : undefined;
}

function normalizeButtonColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const key = value.trim().toLowerCase().replace(/_/g, '-');

  if (key === 'green') return 'green';
  if (key === 'dark-blue' || key === 'dark' || key === 'dark_blue') return 'dark_blue';
  if (key === 'white') return 'white';
  if (key === 'black') return 'black';

  return BUTTON_COLORS.has(key) ? key.replace(/-/g, '_') : undefined;
}

function normalizeButtonAction(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;

  const key = value.trim().toLowerCase().replace(/_/g, '-');

  if (key === 'whatsapp') return 'whatsapp';
  if (key === 'contact-form' || key === 'contact_form') return 'contact_form';

  return BUTTON_ACTIONS.has(key) ? key.replace(/-/g, '_') : undefined;
}

function normalizeIconPosition(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const key = value.trim().toLowerCase();

  if (
    key === 'end' ||
    key === 'right' ||
    key === 'trailing' ||
    key === 'after' ||
    key === 'after text'
  ) {
    return 'end';
  }

  if (key === 'start' || key === 'left' || key === 'leading' || key === 'before') {
    return 'start';
  }

  return ICON_POSITIONS.has(key) ? key : undefined;
}

function normalizeBadgeVariant(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const key = value.trim().toLowerCase();

  if (key === 'dark') return 'dark';
  if (key === 'light') return 'light';

  return BADGE_VARIANTS.has(key) ? key : undefined;
}

function normalizeBannerVariant(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const key = value.trim().toLowerCase();

  if (BANNER_VARIANTS.has(key)) return key;

  return undefined;
}

function normalizeImageRadius(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const key = value.trim().toLowerCase();

  if (key === '2xl') return 'xl2';
  if (key === '3xl') return 'xl3';
  if (IMAGE_RADIUS_VALUES.has(key)) return key;

  return undefined;
}

async function migrateCollection(
  strapi: StrapiInstance,
  uid: string,
  normalizeField: (entry: Record<string, unknown>) => Record<string, unknown> | null,
) {
  const entries = await strapi.db.query(uid).findMany({ limit: 1000 });
  let updated = 0;

  for (const entry of entries) {
    const patch = normalizeField(entry);

    if (!patch || Object.keys(patch).length === 0) continue;

    await strapi.db.query(uid).update({
      where: { id: entry.id },
      data: patch,
    });

    updated += 1;
  }

  return updated;
}

export async function migrateEnumFields(strapi: StrapiInstance) {
  const buttonUpdates = await migrateCollection(
    strapi,
    'api::button.button',
    (entry) => {
      const patch: Record<string, unknown> = {};
      const variant = normalizeButtonVariant(entry.variant);
      const color = normalizeButtonColor(entry.color);
      const action = normalizeButtonAction(entry.action);
      const iconPosition = normalizeIconPosition(entry.iconPosition);

      if (variant && variant !== entry.variant) patch.variant = variant;
      if (color && color !== entry.color) patch.color = color;
      if (action !== undefined && action !== entry.action) patch.action = action;
      if (iconPosition && iconPosition !== entry.iconPosition) {
        patch.iconPosition = iconPosition;
      }

      return Object.keys(patch).length > 0 ? patch : null;
    },
  );

  const badgeUpdates = await migrateCollection(
    strapi,
    'api::badge.badge',
    (entry) => {
      const variant = normalizeBadgeVariant(entry.variant);

      if (!variant || variant === entry.variant) return null;

      return { variant };
    },
  );

  const bannerUpdates = await migrateCollection(
    strapi,
    'api::banner.banner',
    (entry) => {
      const variant = normalizeBannerVariant(entry.variant);

      if (!variant || variant === entry.variant) return null;

      return { variant };
    },
  );

  const imageUpdates = await migrateCollection(
    strapi,
    'api::image-container.image-container',
    (entry) => {
      const imageRadius = normalizeImageRadius(entry.imageRadius);

      if (!imageRadius || imageRadius === entry.imageRadius) return null;

      return { imageRadius };
    },
  );

  const total = buttonUpdates + badgeUpdates + bannerUpdates + imageUpdates;

  if (total > 0) {
    strapi.log.info(
      `Migrated enum fields: buttons=${buttonUpdates}, badges=${badgeUpdates}, banners=${bannerUpdates}, images=${imageUpdates}`,
    );
  }
}
