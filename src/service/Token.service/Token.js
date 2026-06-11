
const jwt = require('jsonwebtoken');

const generateToken = (userId,role) => {
  const accessToken = jwt.sign({ userId,role }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '4h',
  });
  return { accessToken };
};

module.exports = { generateToken };
