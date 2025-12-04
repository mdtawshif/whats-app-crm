# Logger

We are using pino as a structured logger.

# pino transports

You might have to format the logs, write logs to file, sending logs to remote location e.g Elasticsearch, and other log processing. all of these operation will have some cost to the single threaded node application.

To solve the problem, pino provies transports. pino transports runs in a worker thread. so you can do all kinds of log operation without throttling app performance.
