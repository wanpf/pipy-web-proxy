((
  config = JSON.decode(pipy.load('config.json')),

  {
    insert_access_log,
    update_response_time,
  } = pipy.solve('db.js'),

  sslCache = new algo.Cache(null, null, { ttl: 587520 }),

  topDomains = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'int'],

  genericDomainName = domain => (
    (
      first = domain.charAt(0),
      pos = domain.indexOf('.'),
    ) => (
      (first >= '0' && first <= '9') ? (
        domain
      ) : (pos > 0 && domain.indexOf('.', pos + 1) > 0) ? (
        topDomains.includes(domain.split('.')[1]) ? domain : '*' + domain.substring(pos)
      ) : (
        domain
      )
    )
  )(),

  mkcrt = domain => (
    (
      gdn = genericDomainName(domain),
      crt,
      key,
    ) => (
      pipy.exec('/usr/local/flomesh/mkcrt/mak.sh ' + gdn),
      crt = os.readFile('/usr/local/flomesh/mkcrt/temp/domain.cer')?.toString?.(),
      key = os.readFile('/usr/local/flomesh/mkcrt/temp/domain.key')?.toString?.(),
      console.log("[ssl] - make ssl for:", domain, gdn),
      {
        domain: gdn,
        crt: crt && new crypto.Certificate(crt.replaceAll('\\n', '\n')),
        key: key && new crypto.PrivateKey(key.replaceAll('\\n', '\n')),
      }
    )
  )(),

  alpnPolicy = names => (
    ((names.indexOf('h2') + 1) || (names.indexOf('http/1.1') + 1)) - 1
  ),

) => pipy({
  _ssl: null,
  _beginTime: null,
  _newRecord: null,
  _statusCode: null,
  _selectProtocol: null,
})

.export('ssl', {
  __domain: null,
  __target: null,
})

.pipeline('ssl-intercept')
.onStart(
  () => void (
    (__domain?.length > 0) && (
      (_ssl = sslCache.get(genericDomainName(__domain))) || (
        (_ssl = mkcrt(__domain)) && (
          sslCache.set(genericDomainName(__domain), _ssl)
        )
      ),
      (!_ssl?.crt || !_ssl?.key) && console.log('[ssl] - make crt failed.')
    )
  )
)
.branch(
  () => _ssl?.crt && _ssl.key, (
    $=>$.acceptTLS({
      certificate: () => (
        {
          cert: _ssl.crt,
          key: _ssl.key,
        }
      ),
      alpn: alpnPolicy,
    }).to($=>$.link('http-codec'))
  ), (
    $=>$.link('connect')
  )
)

.pipeline('http-codec')
.demuxHTTP().to(
  $=>$
  .replaceMessageStart(
    msg => (
      _beginTime = new Date(),
      _newRecord = insert_access_log('https', __inbound.remoteAddress, msg?.head?.headers?.host || '', msg?.head?.path || '', msg?.head?.headers?.['user-agent'] || ''),
      config?.configs?.enableDebug && (
        console.log('proxy https msg:', msg)
      ),
      msg?.head?.headers?.['upgrade-insecure-requests'] && delete msg.head.headers['upgrade-insecure-requests'],
      msg
    )
  )
  .muxHTTP(() => __inbound, {
    version: () => new Promise(f => _selectProtocol = f)
  }).to(
    $=>$
    .connectTLS({
      sni: () => __domain,
      alpn: ['h2', 'http/1.1'],
      handshake: ({ alpn }) => _selectProtocol(alpn),
    }).to(
      $=>$.link('connect')
    )
  )
  .handleMessageStart(
    msg => _statusCode = (msg?.head?.status || 0)
  )
  .handleMessageEnd(
    () => _newRecord?.id && (
      update_response_time(_newRecord?.id, new Date() - _beginTime, _statusCode)
    )
  )
)

.pipeline('connect')
.connect(() => __target, { connectTimeout: 5, idleTimeout: 60, })

)()