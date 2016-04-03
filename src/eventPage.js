import _ from 'lodash';
import axios from 'axios';
import { alarmUpdateData, alarmUpdateUI } from './alarms.js';

const updateDataPeriodInMins = 1;
let defaultOptions =
{
	gerritUrl: 'http://gerrit/',
	allowNotifications: true
};

(function initialize()
{
	// Setup options and then finish init
	setDefaultOptions(() =>
	{
		chrome.alarms.onAlarm.addListener(alarm => handleAlarm(alarm));
		chrome.notifications.onClicked.addListener(handleNotificationClick);
		chrome.alarms.create(alarmUpdateData, { when: Date.now(), periodInMinutes: updateDataPeriodInMins });
	});
})();

function handleAlarm(alarm)
{
	if(alarm.name === alarmUpdateData)
		updateData();
}

function handleNotificationClick(notificationId)
{
	var changesetNum = notificationId.replace(/^.*_/, '');
	chrome.storage.sync.get('options', ({options}) =>
	{
		chrome.tabs.create({ "url": `${options.gerritUrl}#/c/${changesetNum}/` });
		chrome.windows.getCurrent(null, win =>
		{
			chrome.windows.update(win.id, { focused: true });
		});
	});
}

function updateData(callback)
{
	chrome.storage.sync.get(['gerrit', 'options'], ({gerrit, options}) =>
	{
		axios.all([getChangeInfo(options.gerritUrl)])
			.then(axios.spread((acct, perms) =>
			{
				let newData = transformData(acct);

				if(!gerrit) gerrit = {};
				if(!gerrit.incoming) gerrit.incoming = [];
				if(!gerrit.outgoing) gerrit.outgoing = [];

				if(options && options.allowNotifications)
					analyzeAndNotify(gerrit, newData);
				updateBadge(newData);

				chrome.storage.sync.set({'gerrit': newData, 'unauthorized': false}, () =>
				{
					chrome.alarms.create(alarmUpdateUI, { when: Date.now() });
				});
			}))
			.catch(response =>
			{
				if(response.status == 403)
				{
					chrome.storage.sync.set({'unauthorized': true}, () =>
					{
						chrome.alarms.create(alarmUpdateUI, { when: Date.now() });
					});
				}
			});
	});
}

function updateBadge(gerritData)
{
	let count = 0;

	// Count the number of incoming changes I haven't reviewed yet
	for(var i = 0, len = gerritData.incoming.length; i < len; i++)
	{
		var item = gerritData.incoming[i];
		if(!item.reviewed) count++;
	}

	count = (count > 0) ? count.toString() : '';
	chrome.browserAction.setBadgeText({ text: count });
}

function getChangeInfo(gerritUrl)
{
	return axios.get('/changes/?q=is:open+owner:self&q=is:open+reviewer:self+-owner:self&o=DETAILED_LABELS&o=DETAILED_ACCOUNTS&o=REVIEWED&o=MESSAGES',
	{
		baseURL: gerritUrl.replace(/\/*$/, ''),
		headers: {'X-Requested-With': 'XMLHttpRequest'}
	});
}

function setDefaultOptions(callback)
{
	chrome.storage.sync.get('options', ({options}) =>
	{
		if(!options) options = defaultOptions;

		if(!options.gerritUrl) options.gerritUrl = defaultOptions.gerritUrl;
		if(options.allowNotifications == null) options.allowNotifications = defaultOptions.allowNotifications;

		chrome.storage.sync.set({'options': options}, callback);
	});
}

function transformData(data)
{
	var getChangesetData = d =>
	({
		number: d._number,
		branch: d.branch,
		changeID: d.change_id,
		created: new Date(d.created),
		deletions: d.deletions,
		insertions: d.insertions,
		mergeable: d.mergeable,
		status: d.status,
		subject: d.subject,
		submittable: d.submittable,
		updated: new Date(d.updated),
		labels:
		{
			build: getLabelData(d.labels.Build, d.messages),
			deploy: getLabelData(d.labels.Deploy, d.messages),
			review: getLabelData(d.labels['Code-Review'], d.messages),
			unitTest: getLabelData(d.labels['UnitTest'], d.messages)
		},
		reviewed: d.reviewed
	});

	return {
		outgoing: _.chain(data.data[0]).map(getChangesetData).sortBy('created').value(),
		incoming: _.chain(data.data[1]).map(getChangesetData).sortBy('created').value()
	};
}

function getLabelData(label, messages)
{
	let values = _.chain(label.all)
		.filter(a => a.value && a.date)
		.forEach(a => new Date(a.date))
		.sortBy('date')
		.reverse()
		.value();

	var passed = null;

	if(values.length && values[0].value > 0)
		var passed = true;
	else if(values.length && values[0].value < 0)
		var passed = false;

	var message = (values.length) ? _.find(messages, m => m.date === values[0].date) : '';
	if(message) message = message.message.replace(/^(.|\n)*(?=http)/, '');

	return { passed, message };
}

function analyzeAndNotify(oldData, newData)
{
	let oldIncomingObj = _.keyBy(oldData.incoming, o => o.number);
	let oldOutgoingObj = _.keyBy(oldData.outgoing, o => o.number);

	_.forEach(newData.incoming, (value, index, incoming) =>
	{
		var oldValue = oldIncomingObj[value.number];

		if(!oldValue && !value.reviewed)
			notify('New Review Request', 'You\'ve been asked to review a change.', value.subject, value.number);
		else if(oldValue.reviewed && !oldValue.labels.review.passed && !value.reviewed)
			notify('Failed Review Updated', 'A change you failed in a review has been updated.', value.subject, value.number);
	});

	_.forEach(newData.outgoing, (value, index, outgoing) =>
	{
		var oldValue = oldOutgoingObj[value.number];

		if(!oldValue)
		{} // do nothing
		else if(oldValue.labels.build.passed == null && value.labels.build.passed === false)
			notify('Build Failed', 'One of your changes failed to build.', value.subject, value.number);
		else if(oldValue.labels.deploy.passed == null && value.labels.deploy.passed === false)
			notify('Deploy Failed', 'One of your changes failed to deploy.', value.subject, value.number);
		else if(oldValue.labels.review.passed == null && value.labels.review.passed === false)
			notify('Review Failed', 'One of your changes has failed review.', value.subject, value.number);
		else if(!oldValue.labels.review.passed && value.labels.review.passed === true)
			notify('Review Passed', 'One of your changes has passed review.', value.subject, value.number);
	});
}

function notify(title, message, contextMessage, changesetNum)
{
	var notificationId = _.uniqueId('giles') + '_' + changesetNum;
	chrome.notifications.create(notificationId,
	{
		"type": 'basic',
		"iconUrl": 'logo_128x128.png',
		"title": title,
		"message": message,
		"contextMessage": contextMessage,
		"isClickable": true,
		"eventTime": Date.now()
	});
}
