import ControllerSubscribeChannel from './controller-subscribe-channel';
import ControllerPublishChannel from './controller-publish-channel';

export default class ViewToControllerMessageBus {
  constructor(siftView) {
    this.controllerSubscribeChannel = new ControllerSubscribeChannel(siftView);
    this.controllerPublishChannel = new ControllerPublishChannel();
  }

  // Publishes a generic message to the Sift Controller.
  publish(data, origin) {
    this.controllerPublishChannel.publish(data, origin);
  }

  subscribe(topic, handler) {
    this.controllerSubscribeChannel.subscribe(topic, handler);
  }

  unsubscribe(topic, handler) {
    this.controllerSubscribeChannel.unsubscribe(topic, handler);
  }

  // Publishes a 'loadData' message to the Controller and returns the data
  // specified in params.
  loadData(params) {
    return new Promise((resolve, reject) => {
      const uuid = this.controllerSubscribeChannel.emitter.reserveUUID((params) => {
        this.controllerSubscribeChannel.emitter.removeAllListeners(uuid);
        if (params.error) {
          reject(params.error);
        } else {
          resolve(params.result);
        }
      });

      this.publish({
        method: 'loadData',
        params: params,
        uuid: uuid
      }, '*');
    });
  }
}
