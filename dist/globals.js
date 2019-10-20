"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let log = {
    verbose: (template, ...params) => { },
    info: (template, ...params) => { },
    warn: (template, ...params) => { }
};
function getLog() {
    return log;
}
exports.getLog = getLog;
function setLog(logImpl) {
    log = logImpl;
}
exports.setLog = setLog;
