import './app.less';
import _ from 'lodash';
import React, { Component, PropTypes } from 'react';
import ClassNames from 'classnames';

let defaultData =
{
	test: 42
};

export default class App extends Component
{
	componentDidMount()
	{
		chrome.storage.sync.get('gerrit', data => this.setState(data.gerrit));
	}
	render()
	{
		let data = this.state || defaultData;

		return (
			<div>Indubitibly {data.test}</div>
		);
	}
}
