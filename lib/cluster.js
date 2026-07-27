// Copyright The Prometheus Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

/**
 * Extends the Registry class with a `clusterMetrics` method that returns
 * aggregated metrics for all workers.
 *
 * In cluster workers, listens for and responds to requests for metrics by the
 * cluster master.
 */

const { debuglog } = require('node:util');
const Registry = require('./registry');
// We need to lazy-load the 'cluster' module as some application servers -
// namely Passenger - crash when it is imported.
let cluster = () => {
	const data = require('cluster');
	cluster = () => data;
	return data;
};

const debug = debuglog('prom:metrics:cluster');
const ANNOUNCEMENT = '@prometheus-io/client:announcement';
const GET_METRICS_REQ = '@prometheus-io/client:getMetricsReq';
const GET_METRICS_RES = '@prometheus-io/client:getMetricsRes';

let registries = [Registry.globalRegistry];
let requestCtr = 0; // Concurrency control
const requests = new Map(); // Pending requests for workers' local metrics.

class AggregatorRegistry extends Registry {
	/**
	 * Create a Registry.
	 * @param regContentType
	 */
	constructor(regContentType = Registry.PROMETHEUS_CONTENT_TYPE) {
		super(regContentType);

		if (cluster().isPrimary) {
			this.workers = new Map();
		}

		addListeners(this);
	}

	addWorker(id) {
		if (this.workers.has(id)) {
			debug('duplicate worker announcement', id);
			return;
		}

		const worker = cluster().workers[id];

		worker.on('disconnect', () => {
			debug('worker disconnected', id);
			this.workers.delete(id);
		});

		worker.on('message', message => {
			if (message.type === GET_METRICS_RES) {
				const request = requests.get(message.requestId);

				if (request === undefined) {
					debug('unexpected results from worker', id);
					return;
				}

				const response = request.responseHandlers.get(id);
				if (response === undefined) {
					return;
				}
				request.responseHandlers.delete(id);

				if (message.error) {
					response.reject(new Error(message.error));
				} else {
					response.resolve({
						threadId: id,
						metrics: message.metrics,
					});
				}
			}
		});

		this.workers.set(id, worker);
	}
	/**
	 * Gets aggregated metrics for all workers. The optional callback and
	 * returned Promise resolve with the same value; either may be used.
	 * @returns {Promise<string>} Promise that resolves with the aggregated
	 *   metrics.
	 */
	clusterMetrics() {
		const requestId = requestCtr++;
		const orderedWorkers = [...this.workers.values()].sort(
			(left, right) => left.id - right.id,
		);

		return new Promise((resolve, reject) => {
			let settled = false;
			function done(err, result) {
				if (settled) return;
				settled = true;

				clearTimeout(request.errorTimeout);
				requests.delete(requestId);

				if (err !== undefined) {
					reject(err);
				} else {
					resolve(result);
				}
			}

			const responseHandlers = new Map();
			const request = {
				responseHandlers,
				done,
				errorTimeout: setTimeout(() => {
					const err = new Error(
						`Operation timed out. ${request.responseHandlers.size} outstanding responses.`,
					);
					request.done(err);
				}, 5_000),
			};
			requests.set(requestId, request);
			const workerMetrics = orderedWorkers.map(
				worker =>
					new Promise((resolveResponse, rejectResponse) => {
						responseHandlers.set(worker.id, {
							resolve: resolveResponse,
							reject: rejectResponse,
						});

						worker.send({
							type: GET_METRICS_REQ,
							requestId,
						});
					}),
			);

			const myMetrics = Promise.all(
				registries.map(r => r.getMetricsAsJSON()),
			).then(metrics => {
				return { metrics };
			});

			if (workerMetrics.length === 0) {
				debug('No workers found for requestId', requestId);
			}

			const allMetrics = [myMetrics, ...workerMetrics];

			Promise.all(allMetrics)
				.then(responses => responses.flatMap(response => response.metrics))
				.then(metrics => Registry.aggregate(metrics).metrics())
				.then(result => done(undefined, result), done);
		});
	}

	get contentType() {
		return super.contentType;
	}

	/**
	 * Creates a new Registry instance from an array of metrics that were
	 * created by `registry.getMetricsAsJSON()`. Metrics are aggregated using
	 * the method specified by their `aggregator` property, or by summation if
	 * `aggregator` is undefined.
	 * @param {Array} metricsArr Array of metrics, each of which created by
	 *   `registry.getMetricsAsJSON()`.
	 * @param {string} registryType content type of the new registry. Defaults
	 * to PROMETHEUS_CONTENT_TYPE.
	 * @returns {Registry} aggregated registry.
	 */
	static aggregate(
		metricsArr,
		registryType = Registry.PROMETHEUS_CONTENT_TYPE,
	) {
		return Registry.aggregate(metricsArr, registryType);
	}

	/**
	 * Sets the registry or registries to be aggregated. Call from workers to
	 * use a registry/registries other than the default global registry.
	 * @param {Array<Registry>|Registry} regs Registry or registries to be
	 *   aggregated.
	 * @returns {void}
	 */
	static setRegistries(regs) {
		if (!Array.isArray(regs)) regs = [regs];
		regs.forEach(reg => {
			if (!(reg instanceof Registry)) {
				throw new TypeError(`Expected Registry, got ${typeof reg}`);
			}
		});
		registries = regs;
	}
}

/**
 * Adds event listeners for cluster aggregation. Idempotent (safe to call more
 * than once).
 * @returns {void}
 */
function addListeners(registry) {
	if (cluster().isPrimary) {
		// Listen for worker responses to requests for local metrics
		cluster().on('message', (worker, message) => {
			if (message.type === ANNOUNCEMENT) {
				registry.addWorker(worker.id);
			}
		});

		announce();
	} else {
		// Respond to master's requests for worker's local metrics.
		process.on('message', async message => {
			if (message.type === ANNOUNCEMENT) {
				process.send({ type: ANNOUNCEMENT });
			} else if (message.type === GET_METRICS_REQ) {
				const metrics = await Promise.all(
					registries.map(r => r.getMetricsAsJSON()),
				);

				try {
					process.send({
						type: GET_METRICS_RES,
						requestId: message.requestId,
						metrics,
					});
				} catch (error) {
					process.send({
						type: GET_METRICS_RES,
						requestId: message.requestId,
						error: error.message,
					});
				}
			}
		});

		process.send({ type: ANNOUNCEMENT });
	}
}

function announce() {
	for (const worker of Object.values(cluster().workers)) {
		if (worker.isConnected()) {
			worker.send({ type: ANNOUNCEMENT });
		}
	}
}

module.exports = AggregatorRegistry;
