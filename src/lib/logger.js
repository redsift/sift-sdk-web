export default class Logger {
    constructor(log) {
        if (!log) {
          this.logger = console;
        } else {
          this.logger = log;
        }
    }
}
