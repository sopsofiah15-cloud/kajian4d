const crypto = require('crypto');

function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw)).digest('hex');
}

function checkToken(req) {
  const header = req.headers['authorization'] || '';
  const token = header.replace('Bearer ', '').trim();
  return Boolean(token) && token === process.env.ADMIN_API_TOKEN;
}

module.exports = { hashPassword, checkToken };
