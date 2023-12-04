((
  config = JSON.decode(pipy.load('config.json')),
) => pipy()

.export('main', {
  __server: null,
})

.repeat(
  Object.entries(config.servers),
  ($, [addr, v])=>$
    .listen(addr, { protocol: 'tcp', ...v, ...(v.maxConnections > 0 && { maxConnections: Math.ceil(v.maxConnections / __thread.concurrency) }) })
    .onStart(
      () => (
        __server = v,
        new Data
      )
    )
    .use('proxy-main.js', 'proxy'),
)

.branch(
  config?.configs?.accessLogQueryPort > 0, (
    $=>$
    .listen(config?.configs?.accessLogQueryPort)
    .serveHTTP((
      (
        db = sqlite('access_log.db'),
        headers = { 'content-type': 'application/json' },
        web = new http.Directory('/admin', {
          fs: false,
          index: ['index.html', 'index.htm'],
        }),
      ) => (
        req => (
          req.head.path.startsWith('/api') ?
            invoke(
              () => new Message(
                { status: 200, headers },
                JSON.encode(db.exec(req.body.toString()))
              ),
              (error) => new Message(
                { status: 500, headers },
                JSON.encode({ error })
                ),
            ) : (
              web.serve(req)
            )
          )
        )
      )()
    )
  )
)

)()