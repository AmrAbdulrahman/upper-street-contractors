export const DEFAULT_ROBOTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large" as const,
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};
