import Observable from '@redsift/observable';

export default class SiftStorage extends Observable {
  constructor() {
    super();
  }

  init(treo) {
    Object.keys(treo).forEach((method) => {
      this[method] = treo[method];
    });
  }
}
