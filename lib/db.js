const { neon } = require('@neondatabase/serverless');

function getSql() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL belum diatur. Hubungkan database Neon lewat Vercel Storage terlebih dahulu.'
    );
  }
  return neon(connectionString);
}

module.exports = { getSql };
