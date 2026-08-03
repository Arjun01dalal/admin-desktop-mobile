/**
 * Secure crypto helpers — MAIN PROCESS ONLY.
 * Encryption key never leaves this process.
 */
const CryptoJS = require('crypto-js');
const { getEntkValue } = require('../config.cjs');

function encrypt(payload) {
  return CryptoJS.AES.encrypt(JSON.stringify(payload), getEntkValue()).toString();
}

function decrypt(cipherText) {
  if (cipherText == null) return cipherText;
  if (typeof cipherText !== 'string') return cipherText;
  const bytes = CryptoJS.AES.decrypt(cipherText, getEntkValue());
  const text = bytes.toString(CryptoJS.enc.Utf8);
  if (!text) throw new Error('Failed to decrypt response');
  return JSON.parse(text);
}

function unwrap(data) {
  if (data == null) return data;
  if (typeof data === 'string') {
    const decrypted = decrypt(data);
    return decrypted?.payload ?? decrypted;
  }
  if (data?.payload !== undefined) return data.payload;
  return data;
}

module.exports = { encrypt, decrypt, unwrap };
