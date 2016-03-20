module.exports = function(grunt)
{
	grunt.initConfig(
	{
		copy:
		{
			main:
			{
				files:
				[
					{
						src:
						[
							'logo/*.png',
							'manifest.json',
							'src/browserAction/browserAction.html',
							'src/options/options.html'
						],
						dest: 'publish/',
						expand: true,
						flatten: true,
						filter: 'isFile'
					}
				]
			}
		},
		compress:
		{
			chrome:
			{
				options: { mode: 'zip', archive: 'publish/Giles.zip' },
				files: [{ src: ['publish/*', '*.pem'], expand: true, flatten: true }]
			}
		}
	});
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.registerTask('default', ['copy', 'compress']);
};
