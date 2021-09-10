/** @type {import('@ts-jest/dist/types').InitialOptionsTsJest} */
const esModules = ['@localfirst/relay-client'].join('|');

module.exports = {
	preset: 'ts-jest',
	setupFiles: [
		'./setupTests.js'
	],
	transform: {
		[`(${esModules}).+\\.js$`]: 'babel-jest',
	},
	testEnvironment: "jsdom",
    transformIgnorePatterns: [`/node_modules/(?!${esModules})`],
};