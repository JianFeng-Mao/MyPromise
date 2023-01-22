// 定义promise三种状态
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

// 定义 promise 内部属性，实例不可更改
const promiseState = Symbol('promiseState');
const promiseResult = Symbol('promiseResult');

/**
 * 判断是否为函数
 * @param {*} func 
 * @returns 
 */
function isFunction(func) {
  return typeof func === 'function';
}

/**
 * 向事件队列中添加一个异步任务
 * @param {*} func 
 */
function addMicroTask(func) {
  if(globalThis.process && globalThis.process.nextTick) {
    globalThis.process.nextTick(func);
  } else if(isFunction(MutationObserver)) {
    const p = document.createElement('p');
    const observer = new MutationObserver(func);
    const config = { childList: true };
    observer.observe(p, config);
    p.innerHTML = '1';
  } else {
    setTimeout(() => {
      func();
    }, 0);
  }
}

/**
 * promise 解决过程 [[Resolve]](promise2, x)
 */
function resolvePromise(promise2, x, resolve, reject) {
  if(x === promise2) { // 2.3.1 如果 promise 和 x 指向同一对象，以 TypeError 为据因拒绝执行 promise 
    throw new TypeError('Chaining cycle detected for promise #<Promise>');
  } else if(x instanceof MyPromise) { // 2.3.2 如果 x 为 Promise ，则使 promise 接受 x 的状态
    x.then(
      y => resolvePromise(promise2, y, resolve, reject),
      reject
    )
  } else if(x !== null && typeof x === 'object' || typeof x === 'function') {
    // 2.3.3 如果 x 为对象或者函数 
    try {
      // 避免重复调用
      var called = false;
      // 2.3.3.1 把x.then赋值给then
      var then = x.then;
      if(isFunction(then)) {
        /*  2.3.3.3 
        * 如果 then 是函数，将 x 作为函数的作用域 this 调用之。
        * 传递两个回调函数作为参数，
        * 第一个参数叫做 `resolvePromise` ，第二个参数叫做 `rejectPromise`
        */
        then.call(
          x,
          y => {
            if(called) {
              return;
            }
            called = true;
            resolvePromise(promise2, y, resolve, reject);
          },
          e => {
            if(called) {
              return;
            }
            called = true;
            reject(e);
          }
        )
      } else {
        resolve(x);
      }
    } catch (e) {
      // 2.3.3.2 如果取 x.then 的值时抛出错误 e ，则以 e 为据因拒绝 promise
      if(called) {
        return;
      }
      called = true;
      reject(e);
    }
  } else {
    // 2.3.4 如果 x 不为对象或者函数，以 x 为参数执行 promise
    resolve(x)
  }
}

class MyPromise {
  constructor(executor) {
    this[promiseState] = PENDING;
    this[promiseResult] = undefined;
    this.handlers = [];
    try {
      executor(this.resolve.bind(this), this.reject.bind(this));
    } catch (e) {
      console.error(e);
      this.reject(e);
    }
  }

  runOneHandler({ executor, state, promise2, resolve, reject }) {
    addMicroTask(() => {
      if(this[promiseState] !== state) {
        return;
      }
      try {
        if(!isFunction(executor)) {
          this[promiseState] === FULFILLED ? resolve(this[promiseResult]) : reject(this[promiseResult])
        } else {
          let x = executor(this[promiseResult]);
          resolvePromise(promise2, x, resolve, reject);
        }
      } catch (e) {
        console.error(e);
        reject(e);
      }
    })

  }

  runHandlers() {
    if(this[promiseState] === PENDING) {
      return;
    }

    while(this.handlers[0]) {
      const handler = this.handlers[0];
      this.runOneHandler(handler);
      this.handlers.shift();
    }
  }

  _changeState(state, res) {
    if(this[promiseState] !== PENDING) {
      return;
    }
    this[promiseState] = state;
    this[promiseResult] = res;
    this.runHandlers();
  }

  resolve(res) {
    this._changeState(FULFILLED, res);
  }

  reject(reason) {
    this._changeState(REJECTED, reason);
  }

  pushHandler(executor, state, promise2, resolve, reject) {
    this.handlers.push({
      executor,
      state,
      promise2,
      resolve,
      reject
    })
  }

  then(onFulfilled, onRejected) {
    const promise2 = new MyPromise((resolve, reject) => {
      addMicroTask(() => {
        this.pushHandler(onFulfilled, FULFILLED, promise2, resolve, reject);
        this.pushHandler(onRejected, REJECTED, promise2, resolve, reject);
        this.runHandlers();
      })
    })
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