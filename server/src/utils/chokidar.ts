import { EventEmitter } from 'events';

export function readyEvent(watcher: EventEmitter): Promise<undefined> {
  return new Promise<undefined>(resolve => {
    watcher.once('ready', resolve);
  });
}
