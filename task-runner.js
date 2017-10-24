const Process = require('child_process');

const MAX_TASKS_TO_LIST = 25;
const MAX_CONCURRENT_TASKS = 20;
const MAX_TASK_AGE_TO_LIST = 60 * 60 * 1000; // one hour

const testSuiteNames = [
	'testSuite1',	'testSuite2',	'testSuite3',	'testSuite4',
	'testSuite5', 'testSuite6',	'testSuite7',	'testSuite8'
];

const createTaskId = () => {
	return '' + Math.floor(Math.random() * 10000000) + 1;
}

const copyTask = task => {
	const proc = task.process;
	delete task.process;
	const obj = JSON.stringify(task);
	task.process = proc;
	return JSON.parse(obj);
};

const tasks = {};

const status = {
	pending: 'pending',
	running: 'running',
	completed: 'completed',
	error: 'error',
	cancelled: 'cancelled'
}

class Task {
	constructor(taskName) {
		this.time = { start: Date.now() };
		this.status = status.pending;
		this.taskName = taskName;
	}

	getRuntime() {
		return this.time.end ? this.time.end - this.time.start : Date.now() - this.time.start;
	}
}

const _runTask = (suite) => {
	const taskId = createTaskId();
	const task = tasks[taskId] = new Task(suite);

 	const promise = new Promise((resolve, reject) => {

	 	const process = task.process = Process.spawn('node', ['simpletestrunner', suite]);
	 	task.status = status.running;

	 	var output = '';

	 	const parseOutput = output => {

	 		const results = { failures : [] };

		 	const regexes = {
		 		runResult: /Passed:\s+\d+(\sFailed:\s\d+)?/i,
		 		failure: /Test ('.+?') failed with (.+?)\.(\s*[\r\n]*Reason:.*)?/gi
		 	};

	 		if (output.trim().match(regexes.runResult)) {
	 			const runResultMatch = output.trim().match(regexes.runResult);
	 			var passed = runResultMatch[0].trim().match(/Passed:\s+(\d+)/i)[1];
	 			var failed = runResultMatch[1] ? runResultMatch[1].trim().match(/Failed:\s+(\d+)/i)[1] : 0;
	 			console.log(`passed: ${passed}; failed: ${failed}`);
	 			results.passed = parseInt(passed) ? parseInt(passed) : 0;
	 			results.failed = parseInt(failed) ? parseInt(failed) : 0;

		 		const failureMatches = output.trim().match(regexes.failure);
		 		if (failureMatches) {
		 			failureMatches.forEach(match => {
						const failureMatch = match.match(new RegExp(regexes.failure.source, 'i'));
						const failureReason = failureMatch[3] ? failureMatch[3].match(/Reason:(.*)/)[1].trim() : undefined;
			 			results.failures.push({ test: failureMatch[1], exception: failureMatch[2], reason: failureReason });	 	
		 			});		 			
		 		}	 			 			
	 		} else {
	 			results.status = status.error;
	 			results.output = output.trim();
	 		}

	 		if (results.failures.length === 0) { delete results.failures; }

	 		return results;
	 	};

	 	process.stdout.on('data', data => {
	 		console.log(`[${taskId}]: ${data}`);
	 		output = output.concat(data);
	 	});

	 	process.stderr.on('data', data => {
	 		console.error(`[${taskId}-error]: ${data}`);
	 		output = output.concat(data);
	 	});

	 	process.on('close', code => {
	 		delete task.process;

	 		task.time.end = Date.now();

	 		if (code == 0) {
	 			task.status = status.completed;
				task.result = parseOutput(output.toString());
	 		} else {
	 			if (task.status === status.cancelled) {
	 				console.log(`task ${taskId} cancelled.`);
	 			} else {
	 				task.status = status.error;
					task.result = parseOutput(output.toString());
	 			}
	 		}
	 		resolve();
	 	});
	});

 	return { promise: promise, id: taskId };
}

function runTask(testSuite) {
	if (testSuiteNames.indexOf(testSuite) === -1) {
		return undefined;
	}

	const numRunningTasks = Object.keys(tasks).filter(taskId => tasks[taskId].status === status.running).length;

	if (numRunningTasks >= MAX_CONCURRENT_TASKS) {
		return false;
	}

	let taskHandle = _runTask(testSuite);

	console.log('running task ' + taskHandle.id);

	return { id: taskHandle.id, status: tasks[taskHandle.id].status };
}

function getStatus(taskId) {
	const task = tasks[taskId];
	return task ? { status: task.status, suite: task.taskName, startTime: task.time.start, endTime: task.time.end, runtime: tasks[taskId].getRuntime() } : undefined;
}

function getResult(taskId) {
	const task = tasks[taskId];
	if (!task) {
		return undefined;
	} else if (task.status === status.pending || task.status === status.running) {
		return { error: `Task ${taskId} is in '${task.status}' status and has no result.`}
	}
	return {
		suite: task.taskName,		
		status: task.status,
		runtime: task.getRuntime(),
		result: task.result ? task.result : undefined
	}
}

function cancelTask(taskId) {
	const task = tasks[taskId];
	if (!task) {
		return undefined;
	}
	if (!task.process || task.status !== status.running && task.status !== status.pending) {
		return false;
	}
	task.status = status.cancelled;
	task.process.kill('SIGHUP');
	return true;
}

function listTasks(taskStatus) {
	const now = Date.now();
	var taskIds = Object.keys(tasks).filter(taskId => now - tasks[taskId].time.start < MAX_TASK_AGE_TO_LIST);

	if (taskStatus) {
		taskIds = taskIds.filter(taskId => tasks[taskId].status === taskStatus);
	};

	return taskIds.map(taskId => {
		const _task = getStatus(taskId);
		_task.id = taskId;
		if (taskStatus) {
			delete _task.status;
		}
		return _task;
	})
	.sort((a, b) => b.startTime - a.startTime)
	.slice(0, MAX_TASKS_TO_LIST)
	.sort((a, b) => a.startTime - b.startTime);
}

function listSuites() {
	return testSuiteNames.reduce((list, suiteName) => {
		list.push(suiteName);
		return list;
	}, []);
}

module.exports  = {
	runTask,
	getStatus,
	getResult,
	cancelTask,
	listTasks,	
	listSuites,
	status,
	MAX_CONCURRENT_TASKS
};