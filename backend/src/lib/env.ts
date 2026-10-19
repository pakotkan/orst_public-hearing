function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  PORT: Number(process.env.PORT ?? 3001),
  JWT_SECRET: required('JWT_SECRET'),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? './uploads',
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
  ADMIN_FIRST_NAME: process.env.ADMIN_FIRST_NAME ?? 'System',
  ADMIN_LAST_NAME: process.env.ADMIN_LAST_NAME ?? 'Administrator',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
}

// Refuse to start in production with the placeholder values from .env.example.
if (process.env.NODE_ENV === 'production') {
  if (env.JWT_SECRET === 'CHANGE_ME' || env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production (openssl rand -hex 32)')
  }
  if (env.ADMIN_PASSWORD === 'CHANGE_ME') throw new Error('ADMIN_PASSWORD is still CHANGE_ME')
}
