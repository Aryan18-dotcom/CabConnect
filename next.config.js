/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.1.15'],
  serverExternalPackages: ['better-sqlite3', 'argon2']
};

export default nextConfig;
