// userStore — kept as the stable import path/interface authService already
// uses (findByEmail/findById/create). Implementation now delegates to the
// SQLite-backed userRepository instead of a flat JSON file.

const userRepository = require("../repositories/userRepository");

module.exports = {
  findByEmail: userRepository.findByEmail,
  findById: userRepository.findById,
  create: userRepository.create,
};
