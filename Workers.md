# Notes on collection and short-lived processes

Statsd uses a fire and forget method for dumping stats to an external handler that is responsible
for the persistence of that data. OpenTelemetry and Prometheus, in contrast, assume that the
services are stable enough that we can ask them every so often for the data, and rely on them still
being there when we ask again later. This creates some challenges for gathering telemetry from
short running programs, child processes, and isolates.

Telemetry data is a mixture of values, such as Gauges, and sums, such as Counts and
Histograms. If a process crashes or becomes unresponsive, then it is no longer available to report
those sum values, causing them to be deducted from the aggregated data. This causes artifacts
in the telemetry data - places where numbers go down or remain flat when they should be
monotonically increasing. These data artifacts can and do result in judgment errors by human
operators performing triage, capacity planning, and a number of other tasks. As the person gathering
the telemetry, it is incumbent upon you to do your level best to avoid bad data being recorded.

We generally let processes crash on unhandled exceptions and rejections, but that complicates
telemetry collection. If you're thinking of adding Prometheus telemetry to your application, or to
a worker thread, one of your first concerns should be in reducing the number of unrecoverable errors
your code contains.

In the case of worker threads, sometimes short-lived is a feature, and in others it's an
inevitability. In these cases, the prometheus client will need a little help from you on tracking
the lifecycle of those workers.

The biggest challenge is that if a worker is unresponsive, then the prometheus client will time out
while trying to collect the aggregated metrics, resulting in NO telemetry being reported at all.
Avoiding this problem would come at a substantial memory premium, as the sum values from every
worker would need to be retained.

Additionally, the Prometheus client retains metadata for every worker it knows about. If you cycle
workers frequently, then that table will grow without bounds. If we knew for certain that a worker
was gone, then some of that metadata can be consolidated across all defunct workers, and as long as
the cardinality of the metrics does not include process-unique data, such as the threadId, then
twenty dead worker is no more expensive than one.

Because of the nature of workers, it is expected that they may saturate the event loop. That means
that if we 'ping' them to see if they are still responsive, then they might not reply until after
we decided they are dead. If they intermittently respond to requests, then the bookkeeping gets
quite elaborate (expensive).

As the application author, you have more control and visibility over the lifecycle of your workers,
especially for worker threads.

## Graceful shutdown

When a worker or cluster worker knows it is terminating, it can flush its latest telemetry to the
aggregator. This orderly shutdown is the most memory efficient option, as the prometheus client
can aggregate the data from all dead workers into a single data structure.

TBD: The final values for gauges may or may not be lost when the process exits.

```
// Code example goes here
```

## Lifecycle events

The main thread can also listen for lifecycle events for its workers and inform us when
any of them exit prematurely. This solution will still result in data loss, and telemetry artifacts,
but will also reduce the number of collection errors and can help the Prometheus client to clean up
metadata related to the lost worker.

We could fix the data loss by retaining data from the previous collection interval, that would
require a good deal of extra storage to facilitate, and therefore would be a substantial tax on
well-behaved workers. Alternatively, we could flag some workers as problematic (example: you have
three pools of workers, and only one tends to crash), but that is currently not supported.

For now, it is recommended that you hook the unhandled exceptions in the Worker itself, then flush
the telemetry data prior to calling `process.exit()`.
