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

)()