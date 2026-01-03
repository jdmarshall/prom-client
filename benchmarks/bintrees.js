'use strict';

const fs = require('fs');
const Path = require('path');
const { createRequire } = require('node:module');

// Comparator function for numbers
const compareNumbers = (a, b) => a - b;

// Comparator function for objects with 'value' property
const compareObjects = (a, b) => a.value - b.value;

function loadRBTree(_, location) {
	const require = createRequire(location);
	const vendored = Path.join(location, './lib/bintrees/rbtree.js');
	const fromModule = Path.join(location, '../bintrees/lib/rbtree.js');

	if (fs.existsSync(vendored)) {
		return require(vendored);
	} else {
		return require(fromModule);
	}
}

module.exports = benchmark => {
	benchmark.suite('RBTree insert operations', suite => {
		function setup(_, location) {
			return loadRBTree(_, location);
		}

		suite.add(
			'insert 10 sequential values',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 10; i++) {
					tree.insert(i);
				}
			},
			{ setup },
		);

		suite.add(
			'insert 100 sequential values',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 100; i++) {
					tree.insert(i);
				}
			},
			{ setup },
		);

		suite.add(
			'insert 1000 sequential values',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 1000; i++) {
					tree.insert(i);
				}
			},
			{ setup },
		);

		suite.add(
			'insert 100 random values',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 100; i++) {
					tree.insert(Math.random() * 10000);
				}
			},
			{ setup },
		);

		suite.add(
			'insert 1000 random values',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 1000; i++) {
					tree.insert(Math.random() * 10000);
				}
			},
			{ setup },
		);

		suite.add(
			'insert 100 reverse sequential values',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 99; i >= 0; i--) {
					tree.insert(i);
				}
			},
			{ setup },
		);
	});

	benchmark.suite('RBTree find operations', suite => {
		function setup(_, location) {
			const RBTree = loadRBTree(_, location);

			const tree100 = new RBTree(compareNumbers);
			for (let i = 0; i < 100; i++) {
				tree100.insert(i);
			}

			const tree1000 = new RBTree(compareNumbers);
			for (let i = 0; i < 1000; i++) {
				tree1000.insert(i);
			}

			const tree10000 = new RBTree(compareNumbers);
			for (let i = 0; i < 10000; i++) {
				tree10000.insert(i);
			}

			return { tree100, tree1000, tree10000 };
		}

		suite.add(
			'find in tree with 100 values',
			(_, { tree100 }) => {
				tree100.find(50);
			},
			{ setup },
		);

		suite.add(
			'find in tree with 1000 values',
			(_, { tree1000 }) => {
				tree1000.find(500);
			},
			{ setup },
		);

		suite.add(
			'find in tree with 10000 values',
			(_, { tree10000 }) => {
				tree10000.find(5000);
			},
			{ setup },
		);

		suite.add(
			'find non-existent in tree with 1000 values',
			(_, { tree1000 }) => {
				tree1000.find(-1);
			},
			{ setup },
		);
	});

	benchmark.suite('RBTree min/max operations', suite => {
		function setup(_, location) {
			const RBTree = loadRBTree(_, location);

			//TODO: For consistency between runs, this data should be determined statically -JDM
			const tree100 = new RBTree(compareNumbers);
			for (let i = 0; i < 100; i++) {
				tree100.insert(Math.random() * 1000);
			}

			const tree1000 = new RBTree(compareNumbers);
			for (let i = 0; i < 1000; i++) {
				tree1000.insert(Math.random() * 1000);
			}

			return { tree100, tree1000 };
		}

		suite.add(
			'min with 100 values',
			(_, { tree100 }) => {
				tree100.min();
			},
			{ setup },
		);

		suite.add(
			'min with 1000 values',
			(_, { tree1000 }) => {
				tree1000.min();
			},
			{ setup },
		);

		suite.add(
			'max with 100 values',
			(_, { tree100 }) => {
				tree100.max();
			},
			{ setup },
		);

		suite.add(
			'max with 1000 values',
			(_, { tree1000 }) => {
				tree1000.max();
			},
			{ setup },
		);
	});

	benchmark.suite('RBTree iteration operations', suite => {
		function setup(_, location) {
			const RBTree = loadRBTree(_, location);

			//TODO: For consistency between runs, this data should be determined statically -JDM
			const tree100 = new RBTree(compareNumbers);
			for (let i = 0; i < 100; i++) {
				tree100.insert(Math.random() * 1000);
			}

			const tree1000 = new RBTree(compareNumbers);
			for (let i = 0; i < 1000; i++) {
				tree1000.insert(Math.random() * 1000);
			}

			return { tree100, tree1000 };
		}

		suite.add(
			'iterate all 100 values with each()',
			(_, { tree100 }) => {
				tree100.each(() => {});
			},
			{ setup },
		);

		suite.add(
			'iterate all 1000 values with each()',
			(_, { tree1000 }) => {
				tree1000.each(() => {});
			},
			{ setup },
		);

		suite.add(
			'iterate 10 values with iterator',
			(_, { tree1000 }) => {
				const iter = tree1000.iterator();
				for (let i = 0; i < 10; i++) {
					iter.next();
				}
			},
			{ setup },
		);
	});

	benchmark.suite('RBTree lowerBound/upperBound operations', suite => {
		function setup(_, location) {
			const RBTree = loadRBTree(_, location);

			const tree = new RBTree(compareNumbers);
			for (let i = 0; i < 1000; i++) {
				tree.insert(i * 2); // Even numbers only
			}

			return tree;
		}

		suite.add(
			'lowerBound exact match',
			(_, tree) => {
				tree.lowerBound(500);
			},
			{ setup },
		);

		suite.add(
			'lowerBound between values',
			(_, tree) => {
				tree.lowerBound(501);
			},
			{ setup },
		);

		suite.add(
			'upperBound',
			(_, tree) => {
				tree.upperBound(500);
			},
			{ setup },
		);
	});

	benchmark.suite('RBTree remove operations', suite => {
		function setup(_, location) {
			return loadRBTree(_, location);
		}

		suite.add(
			'insert and remove 100 values',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 100; i++) {
					tree.insert(i);
				}
				for (let i = 0; i < 100; i++) {
					tree.remove(i);
				}
			},
			{ setup },
		);

		suite.add(
			'insert 100, remove 50',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 100; i++) {
					tree.insert(i);
				}
				for (let i = 0; i < 50; i++) {
					tree.remove(i);
				}
			},
			{ setup },
		);

		suite.add(
			'remove from middle',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 100; i++) {
					tree.insert(i);
				}
				tree.remove(50);
			},
			{ setup },
		);
	});

	benchmark.suite('RBTree with complex objects', suite => {
		function setup(_, location) {
			return loadRBTree(_, location);
		}

		suite.add(
			'insert 100 objects',
			(_, RBTree) => {
				const tree = new RBTree(compareObjects);
				for (let i = 0; i < 100; i++) {
					tree.insert({ value: i, data: `item${i}` });
				}
			},
			{ setup },
		);

		suite.add(
			'find in tree with 100 objects',
			(_, RBTree) => {
				const tree = new RBTree(compareObjects);
				for (let i = 0; i < 100; i++) {
					tree.insert({ value: i, data: `item${i}` });
				}
				tree.find({ value: 50 });
			},
			{ setup },
		);
	});

	benchmark.suite('RBTree clear operation', suite => {
		function setup(_, location) {
			return loadRBTree(_, location);
		}

		suite.add(
			'clear tree with 100 values',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 100; i++) {
					tree.insert(i);
				}
				tree.clear();
			},
			{ setup },
		);

		suite.add(
			'clear tree with 1000 values',
			(_, RBTree) => {
				const tree = new RBTree(compareNumbers);
				for (let i = 0; i < 1000; i++) {
					tree.insert(i);
				}
				tree.clear();
			},
			{ setup },
		);
	});
};
