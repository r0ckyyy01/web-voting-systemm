import bcrypt from 'bcrypt';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node hash-admin-password.mjs <plain-password>');
  process.exit(1);
}

const rounds = 12;
const hash = await bcrypt.hash(password, rounds);
console.log(hash);