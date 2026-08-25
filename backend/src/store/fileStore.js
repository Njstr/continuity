// fileStore — kept as the stable import path/interface every service and
// route already uses (fileStore.get/set/append). The implementation now
// delegates to the SQLite-backed bucketRepository instead of writing JSON
// files directly. Nothing above this file changed as part of that swap —
// that's the point of the repository pattern.

const bucketRepository = require("../repositories/bucketRepository");

const fileStore = {
  get: bucketRepository.get,
  set: bucketRepository.set,
  append: bucketRepository.append,
};

module.exports = fileStore;
