import './app.less';
import _ from 'lodash';
import React, { Component, PropTypes } from 'react';
import ClassNames from 'classnames';
import Check from 'react-icons/lib/md/check';
import Clear from 'react-icons/lib/md/clear';
import Settings from 'react-icons/lib/md/settings';

export const alarmType =
{
	updateData: 'giles/alarm/update/data',
	updateUI: 'giles/alarm/update/UI'
};

const noOutgoingText =
[
	'Nothing here...better get to work',
	'Nothing out for review...I\'m telling your manager',
	'You have zero work out for review...hmmmm',
	'Nothing...Google knows you\'re not working',
	'Nothing...You remembered to push to gerrit right?',
	'Nothing, which means you should be working right now',
	'Nothing out for review...Are you on vacation?',
	'The browser told everyone you\'re lazy, but I stood up for you',
	'Nothing out for review...Do you need some help?',
	'Nothing here...Maybe you should ask for some work'
];

const noIncomingText =
[
	'Woot! No reviews for you',
	'All clear, does\'t that feel good?',
	'Whew, nothing here',
	'Relax, there aren\'t any reviews for you do',
	'Nothing...Now you can get some work done'
];

let ChangesetRow = ({change, options}) =>
(
	<tr>
		<td>
			<a href={`${options.gerritUrl}#/c/${change.number}/`} target='_blank' title={change.subject}>{change.subject}</a>
		</td>
		<td>
			{ change.buildPassed === true && <Check style={{color:'#76A01D'}}/> }
			{ change.buildPassed === false && <Clear style={{color:'#DC4A2E'}}/> }
		</td>
		<td>
			{ change.reviewPassed === true && <Check style={{color:'#76A01D'}}/> }
			{ change.reviewPassed === false && <Clear style={{color:'#DC4A2E'}}/> }
		</td>
		<td>
			{ change.deployPassed === true && <Check style={{color:'#76A01D'}}/> }
			{ change.deployPassed === false && <Clear style={{color:'#DC4A2E'}}/> }
		</td>
	</tr>
);

let ChangesetHeader = ({title}) =>
(
	<thead>
		<tr>
			<th>{title}</th>
			<th>B</th>
			<th>CR</th>
			<th>D</th>
		</tr>
	</thead>
);

export default class App extends Component
{
	constructor(props)
	{
		super(props);
		this.state =
		{
			gerrit: { incoming: [], outgoing: [] },
			options: {},
			unauthorized: false
		};
	}
	componentDidMount()
	{
		this.getData();
		chrome.alarms.onAlarm.addListener(alarm =>
		{
			if(alarm.name === alarmType.updateUI)
				this.getData();
		});
	}
	getData()
	{
		chrome.storage.sync.get(['unauthorized', 'gerrit', 'options'], ({unauthorized, gerrit, options}) =>
		{
			this.setState({gerrit, options, unauthorized});
		});
	}
	render()
	{
		let { gerrit, options, unauthorized } = this.state;

		return (
			<div className='browser-action-container'>
				{
					unauthorized &&
					<div className='unauthorized-container'>
						<h1>Please Sign Into Gerrit</h1>
						<p>
							<a href={options.gerritUrl} target='_blank'>Sign In</a>
							<br/>(can take up to a min to take effect).
						</p>
					</div>
				}
				{
					!unauthorized &&
					<div className='changeset-container'>
						<h1>
							Giles
							<div className='icon' onClick={e => chrome.runtime.openOptionsPage()} title='Options'>
								<Settings/>
							</div>
						</h1>
						<table>
							<ChangesetHeader title='Outgoing Reviews'/>
							{
								(!gerrit.outgoing || gerrit.outgoing.length == 0) &&
								<tbody><tr><td colspan='4' className='nothing'>{_.sample(noOutgoingText)}</td></tr></tbody>
							}
							{
								(gerrit.outgoing && gerrit.outgoing.length > 0) &&
								<tbody>{gerrit.outgoing.map(c => <ChangesetRow change={c} options={options} key={c.number} />)}</tbody>
							}
						</table>
						<table>
							<ChangesetHeader title='Incoming Reviews'/>
							{
								(!gerrit.incoming || gerrit.incoming.length == 0) &&
								<tbody><tr><td colspan='4' className='nothing'>{_.sample(noIncomingText)}</td></tr></tbody>
							}
							{
								(gerrit.incoming && gerrit.incoming.length > 0) &&
								<tbody>{gerrit.incoming.map(c => <ChangesetRow change={c} options={options} key={c.number} />)}</tbody>
							}
						</table>
					</div>
				}
			</div>
		);
	}
}
