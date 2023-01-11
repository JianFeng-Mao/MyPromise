// 定义promise三种状态
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

// 定义 promise 内部属性，实例不可更改
const promiseState = Symbol('promiseState');
const promiseResult = Symbol('promiseResult');

function isFunction(func) {
  return typeof func === 'function';
}

/**
 * promise 解决过程 [[Resolve]](promise2, x)
 */
function resolvePromise(promise2, x, resolve, reject) {
  // 2.3.1 如果 promise 和 x 指向同一对象，以 TypeError 为据因拒绝执行 promise
  if(x === promise2) {
    throw new TypeError('Chaining cycle detected for promise #<Promise>');
  } else if(x instanceof MyPromise) {
    // 2.3.2 如果 x 为 Promise ，则使 promise 接受 x 的状态
    x.then(
      y => {
        resolvePromise(promise2, y, resolve, reject);
      },
      reject
    )
  } else if(x && (typeof x === 'object' || isFunction(x))) {
    // 2.3.3 如果 x 为对象或者函数 
    try {
      // 2.3.3.1 把x.then赋值给then
      var then = x.then;
    } catch (e) {
      // 2.3.3.2 如果取 x.then 的值时抛出错误 e ，则以 e 为据因拒绝 promise
      reject(e);
    }

    if(isFunction(then)) {
      // 避免重复调用
      let called = false;
      /**
        * 2.3.3.3 
        * 如果 then 是函数，将 x 作为函数的作用域 this 调用之。
        * 传递两个回调函数作为参数，
        * 第一个参数叫做 `resolvePromise` ，第二个参数叫做 `rejectPromise`
      */
      try {
        then.call(
          x,
          y => {
            if(called) return;
            called = true;
            resolvePromise(promise2, y, resolve, reject);
          },
          e => {
            if(called) return;
            called = true;
            reject(e);
          }
        )
      } catch (e) {
        if(called) return;
        called = true;
        reject(e);
      }
    } else {
      resolve(x);
    }

  } else {
    // 2.3.4 如果 x 不为对象或者函数，以 x 为参数执行 promise
    resolve(x);
  }
}

class MyPromise {
  constructor(func) {
    try {
      this[promiseState] = PENDING;
      this[promiseResult] = undefined;
      this.onFulfilledCallback = [];
      this.onRejectedCallback = [];
      func(this.resolve.bind(this), this.reject.bind(this))
    } catch (e) {
      console.error(e);
      this.reject(e);
    }
  }

  /**
   * 改变promise状态
   * @param {*} state promise状态
   * @param {*} result promise值
   * @param {*} funcs 要执行的任务队列
   */
  _changeState(state, result, funcs) {
    // 当前promise已经为终态时不可重复执行
    if (this[promiseState] === PENDING) {
      this[promiseState] = state;
      this[promiseResult] = result;
      funcs.forEach(cb => {
        cb(result);
      })
    }
  }

  resolve(res) {
    this._changeState(FULFILLED, res, this.onFulfilledCallback)
  }

  reject(reson) {
    this._changeState(REJECTED, reson, this.onRejectedCallback)
  }

  /**
   * then 方法对当前promise不同状态进行不同的处理。逻辑相同，操作的属性不同
   * @param {*} cb 
   * @param {*} handler 
   * @param {*} promise2 
   * @param {*} resolve 
   * @param {*} reject 
   */
  _handleThen(cb, handler, promise2, resolve, reject) {
    try {
      if (!isFunction(cb)) { 
        //  2.2.7.3 如果 onFulfilled 不是函数且 promise1 成功执行， promise2 必须成功执行并返回相同的值
        //  2.2.7.4 如果 onRejected 不是函数且 promise1 拒绝执行， promise2 必须拒绝执行并返回相同的据因
        handler(this[promiseResult]);
      } else {
        // 2.2.7.1规范 如果 onFulfilled 或者 onRejected 返回一个值 x ，则运行下面的 Promise 解决过程：[[Resolve]](promise2, x)
        let x = cb(this[promiseResult]);
        resolvePromise(promise2, x, resolve, reject);
      }
    } catch (e) {
      console.error(e);
      // 2.2.7.2 如果 onFulfilled 或者 onRejected 抛出一个异常 e ，则 promise2 必须拒绝执行，并返回拒因 e
      reject(e);
    }
  }

  then(onFulfilled, onRejected) {
    const promise2 = new MyPromise((resolve, reject) => {
      if (this[promiseState] === FULFILLED) {
        setTimeout(() => {
          this._handleThen(onFulfilled, resolve, promise2, resolve, reject);
        });
      }
      if (this[promiseState] === REJECTED) {
        setTimeout(() => {
          this._handleThen(onRejected, reject, promise2, resolve, reject);
        })
      }
      if (this[promiseState] === PENDING) {
        this.onFulfilledCallback.push(() => {
          setTimeout(() => {
            this._handleThen(onFulfilled, resolve, promise2, resolve, reject);
          })
        })
        this.onRejectedCallback.push(() => {
          setTimeout(() => {
            this._handleThen(onRejected, reject, promise2, resolve, reject);
          })
        })
      }
    })
    // 2.2.7规范 then 方法必须返回一个 promise 对象
    return promise2;
  }
}


// 执行官方测试用例
MyPromise.deferred = function() {
  let result = {};
  result.promise = new MyPromise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  })
  return result;
}


module.exports = MyPromise