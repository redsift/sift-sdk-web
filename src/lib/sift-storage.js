import Observable from './observable';

export default class SiftStorage extends Observable {
  constructor() {}

  init(treo) {
    Object.keys(treo).forEach((method) => {
      this[method] = treo[method];
    });
  }
}
