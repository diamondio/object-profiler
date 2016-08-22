var uuid = require('node-uuid');

var getTime = function () {
  var t = process.hrtime();
  return (1000000000 * t[0] + t[1])/1000000;
}

var functionStats = {};

exports.wrapFunction = function (name, fn, self) {
  if (!self) self = null;
  var functionId = uuid.v4();
  functionStats[functionId] = {
    timeIntervals: [],
    numCalls: 0,
    numOutstanding: 0,
    startTime: 0,
    name: name,
    fn: fn
  };

  return function () {
    var originalCB = arguments[arguments.length - 1];
    arguments[arguments.length - 1] = function () {
      var endTime = getTime();
      functionStats[functionId].numOutstanding--;
      if (functionStats[functionId].numOutstanding === 0) {
        functionStats[functionId].timeIntervals.push({
          start: functionStats[functionId].startTime,
          end: endTime
        });
      }
      if (functionStats[functionId].numOutstanding < 0) {
        console.log(`Oh... looks like ${name} is calling the callback multiple times...\nYou're welcome.`);
      }
      originalCB.apply(null, Array.prototype.slice.call(arguments));
    }
    functionStats[functionId].numCalls++;
    functionStats[functionId].numOutstanding++;
    if (functionStats[functionId].numOutstanding === 1) {
      functionStats[functionId].startTime = getTime();
    }
    fn.apply(self, Array.prototype.slice.call(arguments));
  }
}

exports.wrapObject = function (name, methods, object) {
  methods.forEach(function (method) {
    object[method] = exports.wrapFunction(name + '.' + method, object[method], object);
  })
}

exports.explain = function () {
  var stats = Object.keys(functionStats).map(key => functionStats[key]);
  var getTotalTime = function (stat) {
    var t = 0;
    stat.timeIntervals.forEach(function (interval) {
      t += interval.end - interval.start;
    });
    return t;
  }

  stats.forEach(function (stat) {
    stat.totalTime = getTotalTime(stat);
  })

  stats.sort(function (stata, statb) {
    return statb.totalTime - stata.totalTime;
  })

  stats.forEach(function (stat) {
    if (stat.numCalls === 0) {
      console.log(`${stat.name} was never called.\n`);
      return;
    }
    var totalTime = stat.totalTime;
    var stints = stat.timeIntervals.length;
    console.log(`${stat.name}:\n${totalTime.toFixed(2)}ms of runtime\n${stints} stints\n${stat.numCalls} calls\n${(totalTime/stat.numCalls).toFixed(2)}ms per call on average\n`);
  });
}

if (require.main === module) {
  var someTest = function (cb) {
    for (var i = 0; i < 1000000; i++) {
      var j = i;
    }
    cb();
  }

  exports.wrapFunction('test', someTest)(function () {
    exports.explain();
  });
}