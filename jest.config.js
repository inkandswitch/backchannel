/** @type {import('@ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
	preset: 'ts-jest',
	setupFiles: [
		'./setupTests.js'
	],
	testEnvironment: "jsdom",
    transformIgnorePatterns: [
      "node_modules/(!@localfirst/relay-client)"
    ]
};