import Observable from '@redsift/observable';

export default class EmailClient extends Observable {
  constructor(proxy) {
    super();
    this._proxy = proxy;
  }

  goto(params) {
    this._postMessage('goto', params);
  }

  close() {
    this._postMessage('close');
  }

  _postMessage(topic, value) {
    this._proxy.postMessage({
      method: 'notifyClient',
      params: {
        topic: topic,
        value: value
      }
    });
  }

}
