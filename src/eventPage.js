import axios from 'axios';

chrome.alarms.create('giles/alarm/update', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(alarm =>
{
	console.log("hello world");
});
