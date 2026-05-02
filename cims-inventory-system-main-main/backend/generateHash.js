const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'admin123'; // change to your desired password
  const hash = await bcrypt.hash(password, 10);
  console.log('Hash:', hash);
}

generateHash();