const express = require('express');
const taskRunner = require('./task-runner');

const app = express();

var router = express.Router();

app.get('/', (req, res) => {
	res.send(`<h2>Task Dispatcher</h2><a href="./taskdispatcher/api">REST API</a>`);
});

app.get('/taskdispatcher', (req, res) => {
	res.send(`<h2>Task Dispatcher</h2><a href="./taskdispatcher/api">REST API</a>`);
});

app.get('/taskdispatcher/api', (req, res) => {
	res.send(
		`
		<head>
		<style>span.code-example: { color: red; /* font-family: "Courier New", Courier, monospace */ }</style>
		</head>
		<body>
		<h2>Task Dispatcher REST API</h2>
		<table border="0" cellpadding="4px">
		<tr><td><b>Run Task</b></td><td><span class="code-example">/taskdispatcher/api/runtask/{suite}</span></td></tr>
		<tr><td><b>Get Task Status</b></td><td><span class="code-example">/taskdispatcher/api/status/{task_id}</span></td></tr>
		<tr><td><b>Get Task Result</b></td><td><span class="code-example">/taskdispatcher/api/result/{task_id}</span></td></tr>
		<tr><td><b>Cancel Task</b></td><td><span class="code-example">/taskdispatcher/api/canceltask/{task_id}</span></td></tr>
		<tr><td><b>List Tasks with Status</b></td><td><span class="code-example">/taskdispatcher/api/listtasks/{status}</span></td></tr>
		<tr><td><b>List All Tasks</b></td><td><span class="code-example">/taskdispatcher/api/listtasks</span></td></tr>
		<tr><td><b>List Suites</b></td><td><span class="code-example">/taskdispatcher/api/listsuites</span></td></tr>
		</table>
		</body>
		`);
});

app.get('/taskdispatcher/api/runtask/:suite', (req, res) => {
	const suite = req.params.suite;

	const task = taskRunner.runTask(suite);

	if (task === undefined) {
		res.status(404).send(`{message: "Suite '${suite}' not recognized."}`);
		return;
	} else if (!task) {
		res.status(429).send(`{message: "Limit of ${taskRunner.MAX_CONCURRENT_TASKS} concurrent tasks has been reached."}`);
		return;
	}

  res.send(task);
});

app.get('/taskdispatcher/api/status/:taskId', (req, res) => {
	const taskId = req.params.taskId;

	const status = taskRunner.getStatus(taskId);

	if (!status) {
		res.status(404).send(`{message: "taskId '${taskId}' not recognized."}`);
		return;
	}

  res.send(status);
});

app.get('/taskdispatcher/api/result/:taskId', (req, res) => {
	const taskId = req.params.taskId;

	const status = taskRunner.getResult(taskId);

	if (!status) {
		res.status(404).send(`{message: "taskId '${taskId}' not recognized."}`);
		return;
	}

  res.send(status);
});

app.get('/taskdispatcher/api/canceltask/:taskId', (req, res) => {
	const taskId = req.params.taskId;

	const canceled = taskRunner.cancelTask(taskId);

	if (canceled === undefined) {
		res.status(404).send(`{message: "taskId '${taskId}' not recognized."}`);
		return;
	} else if (!canceled) {
		res.status(400).send(`{message: "taskId '${taskId}' is not running or pending and cannot be canceled."}`);		
	}

  res.send(JSON.parse('{ "canceled": true }'));
});

app.get('/taskdispatcher/api/listsuites', (req, res) => {
  res.send(taskRunner.listSuites());
});

app.get('/taskdispatcher/api/listtasks', (req, res) => {
  res.send(taskRunner.listTasks());
});

app.get('/taskdispatcher/api/listtasks/:status', (req, res) => {
	const status = req.params.status;
	if (!taskRunner.status[status]) {
		res.status(404).send(`{message: "status '${status}' not recognized."}`);
		return;	
	}
  res.send(taskRunner.listTasks(req.params.status));
});

const port = process.env.PORT || '7700';
app.listen(port, () => {
	console.log('TaskDispatcher server listening on  port ' + port);
});
