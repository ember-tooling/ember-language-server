export default class Deferred<T> {
  promise: Promise<T> = new Promise((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });

  resolve: (value?: (PromiseLike<T>|T)) => void;
  reject: (reason?: any) => void;
}
