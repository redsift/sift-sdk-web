import { SiftController } from '../src/index';
import { SiftStorage } from '../src/index';
import { SiftView } from '../src/index';

// Emulate sift running in browser frame
let window = {
  self: 'self',
  top: 'top'
};

// // Emulate sift not running in browser frame
// let window = {
//   self: 'self',
//   top: 'self'
// };

const controller = new SiftController(),
    storage = new SiftStorage(),
    view = new SiftView(window);

controller.toString();
storage.toString();
view.toString();
