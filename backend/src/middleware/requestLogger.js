const morgan = require("morgan");
const config = require("../config");

// 'combined' is the standard Apache-style production access log format;
// 'dev' is the colored, concise format that's actually readable while
// developing. Skipped entirely in test to keep test output clean.
function requestLogger() {
  if (config.nodeEnv === "test") {
    return (req, res, next) => next();
  }
  return morgan(config.isProduction ? "combined" : "dev");
}

module.exports = requestLogger;
