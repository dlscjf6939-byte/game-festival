Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
require("../_virtual/_rolldown/runtime.cjs");
let fumadb_adapters_mongodb = require("fumadb/adapters/mongodb");
//#region src/adapters/mongodb.ts
const mongoAdapter = (options) => Object.assign((0, fumadb_adapters_mongodb.mongoAdapter)(options), { provider: "mongodb" });
//#endregion
exports.mongoAdapter = mongoAdapter;
