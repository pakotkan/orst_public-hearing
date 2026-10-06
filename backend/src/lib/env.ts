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
