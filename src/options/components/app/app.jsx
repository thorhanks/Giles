import './app.less';
import _ from 'lodash';
import React, { Component, PropTypes } from 'react';
import ClassNames from 'classnames';

let saveIndicatorTimeoutHandle = null;
const changesSavedText =
[
	'Saved...FOREVER',
	'Saved...Apparently you made a change',
	'Saved...Can\'t you just be happy with the default?',
	'Saved...As you wish',
	'Saved...Google knows what you just did',
	'Saved...If only I had known that\'s how you liked it',
	'Saved...Woah I thought no one would ever see the options',
	'Saved...You know, Thor is really the best Avenger',
	'Saved...Geez you are so picky',
	'Saved...I just told Google what you did!',
	'Saved...Just think of all the work put into this extension'
];

export default class App extends Component
{
	constructor(props)
	{
		super(props);
		this.state = { options: {}, saveIndicatorText: null };
	}
	componentDidMount()
	{
		chrome.storage.sync.get('options', ({options}) => this.setState({'options': options}));
	}
	saveChange(key, value)
	{
		let options = this.state.options;
		options[key] = value;

		chrome.storage.sync.set({'options': options}, () =>
		{
			this.setState({'saveIndicatorText': _.sample(changesSavedText)});
			if(saveIndicatorTimeoutHandle) clearTimeout(saveIndicatorTimeoutHandle);
			saveIndicatorTimeoutHandle = window.setTimeout(() => this.setState({'saveIndicatorText': null}), 3000);
		});

		this.setState({'options': options});
	}
	render()
	{
		let { options, saveIndicatorText } = this.state;

		return (
			<div className='options-container'>
				{
					saveIndicatorText &&
					<div className='save-indicator'>{saveIndicatorText}</div>
				}
				<label>
					Gerrit URL: <input value={options.gerritUrl} onInput={e => this.saveChange('gerritUrl', e.target.value.trim())}/>
				</label>
				<label>
					Show Notifications: <input type='checkbox' checked={options.allowNotifications} onChange={e => this.saveChange('allowNotifications', e.target.checked)} />
				</label>
				<label>
					Debug: <span className='link' onClick={e => chrome.storage.sync.clear()}>Clear Storage</span>
				</label>
			</div>
		);
	}
}
