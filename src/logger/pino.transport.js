import SonicBoom from 'sonic-boom';
import { once } from 'events';

module.exports = async function (opts) {
  const destination = new SonicBoom({
    dest: opts.destination || 1,
    sync: false,
  });

  await once(destination, 'ready');
  return destination;
};
