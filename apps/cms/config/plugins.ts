import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  graphql: {
    enabled: true,
    config: {
      endpoint: '/graphql',
      shadowCRUD: true,
      playgroundAlways: true,
      introspection: true,
      depthLimit: 10,
      amountLimit: 100,
      apolloServer: {
        introspection: true,
      },
    },
  },
  // Editors log in via /api/auth/local and get rotating access/refresh tokens
  // (instead of the website using a shared full-access API token). `refresh`
  // mode makes login return a refreshToken and enables POST /api/auth/refresh.
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      sessions: {
        accessTokenLifespan: 60 * 60, // 1h — long enough to avoid mid-edit churn
        idleRefreshTokenLifespan: 60 * 60 * 24 * 14, // 14d
        maxRefreshTokenLifespan: 60 * 60 * 24 * 30, // 30d
      },
    },
  },
});

export default config;
