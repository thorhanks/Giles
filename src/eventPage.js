import _ from 'lodash';
import axios from 'axios';

let gerritData = {};
const updateDataPeriodInMins = 1;
let axiosConfig =
{
	baseURL: 'http://gerrit',
	headers: {'X-Requested-With': 'XMLHttpRequest'}
};
export const alarmType =
{
	updateData: 'giles/alarm/update/data',
	updateUI: 'giles/alarm/update/UI',
	unauthorized: 'giles/alarm/unauthorized'
};
let defaultOptions =
{
	gerritUrl: 'http://gerrit/'
};

(function initialize()
{
	// Setup periodic UpdateData alarm and kick off now
	chrome.alarms.onAlarm.addListener(alarm => handleAlarm(alarm));
	chrome.alarms.create(alarmType.updateData, { when: Date.now(), periodInMinutes: updateDataPeriodInMins });
	setDefaultOptions();
})();

function handleAlarm(alarm)
{
	if(alarm.name === alarmType.updateData)
	{
		updateData(() =>
		{
			updateBadge();
			// Notify browser action that it needs to update UI
			chrome.alarms.create(alarmType.updateUI, { when: Date.now() });
		});
	}
}

function updateData(callback)
{
	axios.all([getChangeInfo()])
		.then(axios.spread((acct, perms) =>
		{
			console.log(acct);
			let newData = transformData(acct);
			analyzeAndNotify(gerritData, newData);
			console.log(newData);
			gerritData = newData;
			chrome.storage.sync.set({'gerrit': gerritData}, () => callback());
		}))
		.catch(response =>
		{
			if(response.status == 403) chrome.alarms.create(alarmType.unauthorized, { when: Date.now() });
		});
}

function updateBadge()
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

function setDefaultOptions()
{
	chrome.storage.sync.get('options', ({options}) =>
	{
		if(!options) options = defaultOptions;

		if(!options.gerritUrl) options.gerritUrl = defaultOptions.gerritUrl;

		chrome.storage.sync.set({'options': options});
	});
}

function transformData(data)
{
	var isPassed = (x, d) =>
	{
		let values = _.chain(x.all).forEach(a => {if(a.date) a.date = new Date(a.date);}).sortBy('date').value();
		let last = x.all.length -1;

		if(x.all.length > 0 && x.all[last].value > 0)
			return true;
		else if(x.all.length > 0 && x.all[last].value < 0)
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
		buildPassed: isPassed(d.labels.Build, d),
		deployPassed: isPassed(d.labels.Deploy, d),
		reviewPassed: isPassed(d.labels['Code-Review'], d),
		reviewed: d.reviewed
	});

	return {
		outgoing: _.chain(data.data[0]).map(getChangesetData).sortBy('created').value(),
		incoming: _.chain(data.data[1]).map(getChangesetData).sortBy('created').value()
	};
}

function analyzeAndNotify(oldData, newData)
{
	
}
