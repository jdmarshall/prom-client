'use strict';

const fs = require('fs');
const Path = require('path');
const { createRequire } = require('node:module');

function loadTDigest(_, location) {
	const require = createRequire(location);
	const vendored = Path.join(location, './lib/tdigest/tdigest.js');
	const fromModule = Path.join(location, '../tdigest/dist/tdigest.js');

	if (fs.existsSync(vendored)) {
		return require(vendored).TDigest;
	} else {
		return require(fromModule).TDigest;
	}
}

// Benchmark TDigest operations with various data sizes and patterns

module.exports = benchmark => {
	benchmark.suite('TDigest push operations', suite => {
		function setup(_, location) {
			return loadTDigest(_, location);
		}

		suite.add(
			'push single value',
			(_, TDigest) => {
				const td = new TDigest();
				td.push(42);
			},
			{ setup },
		);

		suite.add(
			'push 100 sequential values',
			(_, TDigest) => {
				const td = new TDigest();
				for (let i = 0; i < 100; i++) {
					td.push(i);
				}
			},
			{ setup },
		);

		suite.add(
			'push 1000 sequential values',
			(_, TDigest) => {
				const td = new TDigest();
				for (let i = 0; i < 1000; i++) {
					td.push(i);
				}
			},
			{ setup },
		);

		suite.add(
			'push 100 random values',
			(_, TDigest) => {
				const td = new TDigest();
				for (let i = 0; i < 100; i++) {
					td.push(Math.random() * 1000);
				}
			},
			{ setup },
		);

		suite.add(
			'push 1000 random values',
			(_, TDigest) => {
				const td = new TDigest();
				for (let i = 0; i < 1000; i++) {
					td.push(Math.random() * 1000);
				}
			},
			{ setup },
		);

		suite.add(
			'push array of 100 values',
			(_, TDigest) => {
				const td = new TDigest();
				const values = Array.from({ length: 100 }, (_, i) => i);
				td.push(values);
			},
			{ setup },
		);

		suite.add(
			'push array of 1000 values',
			(_, TDigest) => {
				const td = new TDigest();
				const values = Array.from({ length: 1000 }, (_, i) => i);
				td.push(values);
			},
			{ setup },
		);
	});

	benchmark.suite('TDigest percentile queries', suite => {
		function setup(_, location) {
			const TDigest = loadTDigest(_, location);

			const td100 = new TDigest();
			for (let i = 0; i < 100; i++) {
				td100.push(Math.random() * 1000);
			}

			const td1000 = new TDigest();
			for (let i = 0; i < 1000; i++) {
				td1000.push(Math.random() * 1000);
			}

			const td10000 = new TDigest();
			for (let i = 0; i < 10000; i++) {
				td10000.push(Math.random() * 1000);
			}

			return { td100, td1000, td10000 };
		}

		suite.add(
			'percentile(0.5) with 100 values',
			(_, { td100 }) => {
				td100.percentile(0.5);
			},
			{ setup },
		);

		suite.add(
			'percentile(0.5) with 1000 values',
			(_, { td1000 }) => {
				td1000.percentile(0.5);
			},
			{ setup },
		);

		suite.add(
			'percentile(0.5) with 10000 values',
			(_, { td10000 }) => {
				td10000.percentile(0.5);
			},
			{ setup },
		);

		suite.add(
			'percentile(0.95) with 1000 values',
			(_, { td1000 }) => {
				td1000.percentile(0.95);
			},
			{ setup },
		);

		suite.add(
			'percentile(0.99) with 1000 values',
			(_, { td1000 }) => {
				td1000.percentile(0.99);
			},
			{ setup },
		);

		suite.add(
			'multiple percentiles with 1000 values',
			(_, { td1000 }) => {
				td1000.percentile([0.5, 0.9, 0.95, 0.99]);
			},
			{ setup },
		);
	});

	benchmark.suite('TDigest compress operations', suite => {
		function setup(_, location) {
			return loadTDigest(_, location);
		}

		suite.add(
			'compress after 100 values',
			(_, TDigest) => {
				const td = new TDigest();
				for (let i = 0; i < 100; i++) {
					td.push(Math.random() * 1000);
				}
				td.compress();
			},
			{ setup },
		);

		suite.add(
			'compress after 1000 values',
			(_, TDigest) => {
				const td = new TDigest();
				for (let i = 0; i < 1000; i++) {
					td.push(Math.random() * 1000);
				}
				td.compress();
			},
			{ setup },
		);

		suite.add(
			'compress after 10000 values',
			(_, TDigest) => {
				const td = new TDigest();
				for (let i = 0; i < 10000; i++) {
					td.push(Math.random() * 1000);
				}
				td.compress();
			},
			{ setup },
		);
	});

	benchmark.suite('TDigest p_rank operations', suite => {
		function setup(_, location) {
			const TDigest = loadTDigest(_, location);

			const td = new TDigest();

			for (let i = 0; i < 1000; i++) {
				td.push(Math.random() * 1000);
			}

			return td;
		}

		suite.add(
			'p_rank single value',
			(_, td) => {
				td.p_rank(500);
			},
			{ setup },
		);

		suite.add(
			'p_rank array of values',
			(_, td) => {
				td.p_rank([100, 250, 500, 750, 900]);
			},
			{ setup },
		);
	});

	benchmark.suite('TDigest with different compression factors', suite => {
		function setup(_, location) {
			return loadTDigest(_, location);
		}

		suite.add(
			'default compression (0.01)',
			(_, TDigest) => {
				const td = new TDigest();
				for (let i = 0; i < 1000; i++) {
					td.push(Math.random() * 1000);
				}

				td.percentile(0.95);
			},
			{ setup },
		);

		suite.add(
			'low compression (0.001)',
			(_, TDigest) => {
				const td = new TDigest(0.001);
				for (let i = 0; i < 1000; i++) {
					td.push(Math.random() * 1000);
				}
				td.percentile(0.95);
			},
			{ setup },
		);

		suite.add(
			'high compression (0.1)',
			(_, TDigest) => {
				const td = new TDigest(0.1);
				for (let i = 0; i < 1000; i++) {
					td.push(Math.random() * 1000);
				}
				td.percentile(0.95);
			},
			{ setup },
		);
	});
};
