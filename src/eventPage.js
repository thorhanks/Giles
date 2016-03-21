import _ from 'lodash';
import axios from 'axios';

const updateDataPeriodInMins = 1;
let axiosConfig =
{
	baseURL: 'http://gerrit',
	headers: {'X-Requested-With': 'XMLHttpRequest'}
};
export const alarmType =
{
	updateData: 'giles/alarm/update/data',
	updateUI: 'giles/alarm/update/UI'
};
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
		chrome.alarms.create(alarmType.updateData, { when: Date.now(), periodInMinutes: updateDataPeriodInMins });
	});
})();

function handleAlarm(alarm)
{
	if(alarm.name === alarmType.updateData)
		updateData();
}

function handleNotificationClick(notificationId)
{
	var changesetNum = notificationId.replace(/^.*_/, '');
	chrome.storage.sync.get('options', ({options}) =>
	{
		chrome.tabs.create({ "url": `${options.gerritUrl}#/c/${changesetNum}/` });
	});
}

function updateData(callback)
{
	axios.all([getChangeInfo()])
		.then(axios.spread((acct, perms) =>
		{
			console.log(acct);
			let newData = transformData(acct);
			console.log(newData);

			let testItem = _.cloneDeep(newData.incoming[0]);
			testItem.number = 249953331387;
			newData.incoming.push(testItem);

			chrome.storage.sync.get(['gerrit', 'options'], ({gerrit, options}) =>
			{
				if(options && options.allowNotifications)
					analyzeAndNotify(gerrit, newData);
				updateBadge(newData);

				chrome.storage.sync.set({'gerrit': newData, 'unauthorized': false}, () =>
				{
					chrome.alarms.create(alarmType.updateUI, { when: Date.now() });
				});
			});
		}))
		.catch(response =>
		{
			if(response.status == 403)
			{
				chrome.storage.sync.set({'unauthorized': true}, () =>
				{
					chrome.alarms.create(alarmType.updateUI, { when: Date.now() });
				});
			}
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

function getChangeInfo()
{
	return axios.get('changes/?q=is:open+owner:self&q=is:open+reviewer:self+-owner:self&o=DETAILED_LABELS&o=REVIEWED', axiosConfig);
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
	var isPassed = x =>
	{
		let values = _.chain(x.all)
			.filter(a => a.value && a.date)
			.forEach(a => new Date(a.date))
			.sortBy('date')
			.reverse()
			.value();

		if(values.length > 0 && values[0].value > 0)
			return true;
		else if(values.length > 0 && values[0].value < 0)
			return false;
		else
			return null;
	};

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
		buildPassed: isPassed(d.labels.Build),
		deployPassed: isPassed(d.labels.Deploy),
		reviewPassed: isPassed(d.labels['Code-Review']),
		reviewed: d.reviewed
	});

	return {
		outgoing: _.chain(data.data[0]).map(getChangesetData).sortBy('created').value(),
		incoming: _.chain(data.data[1]).map(getChangesetData).sortBy('created').value()
	};
}

function analyzeAndNotify(oldData, newData)
{
	let oldIncomingObj = _.keyBy(oldData.incoming, o => o.number);
	let oldOutgoingObj = _.keyBy(oldData.outgoing, o => o.number);

	_.forEach(newData.incoming, (value, index, incoming) =>
	{
		var oldValue = oldIncomingObj[value.number];

		if(!oldValue)
			notify('New Review Request', 'You\'ve been asked to review a change.', value.subject, value.number);
		else if(oldValue.reviewed && !oldValue.reviewPassed && !value.reviewed)
			notify('Failed Review Updated', 'A change you failed in a review has been updated.', value.subject, value.number);
	});

	_.forEach(newData.outgoing, (value, index, outgoing) =>
	{
		var oldValue = oldOutgoingObj[value.number];

		if(!oldValue)
		{} // do nothing
		else if(oldValue.buildPassed == null && value.buildPassed === false)
			notify('Build Failed', 'One of your changes failed to build.', value.subject, value.number);
		else if(oldValue.deployPassed == null && value.deployPassed === false)
			notify('Deploy Failed', 'One of your changes failed to deploy.', value.subject, value.number);
		else if(oldValue.reviewPassed == null && value.reviewPassed === false)
			notify('Review Failed', 'One of your changes has failed review.', value.subject, value.number);
		else if(!oldValue.reviewPassed && value.reviewPassed === true)
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
