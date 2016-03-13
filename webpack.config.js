var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports =
{
	entry:
	{
		eventPage: "./src/eventPage.js"
	},
	output:
	{
		path: './publish',
		filename: '[name].js'
	},
	module:
	{
		loaders:
		[
			{
				test: /\.jsx?$/,
				loader: 'babel',
				exclude: /(node_modules)/,
				query: { presets: ['react', 'es2015'] }
			},
			{ test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') },
			{ test: /\.less$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader!less-loader') }
		],
	},
	resolve:
	{
		modulesDirectories: ['node_modules']
	},
	plugins:
	[
		new webpack.DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('production') }),
		new ExtractTextPlugin('[name].css')
	],
	devtool: 'source-map'
};
