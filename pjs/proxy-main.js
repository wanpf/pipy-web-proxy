((
  config = JSON.decode(pipy.load('config.json')),
  acl = JSON.decode(pipy.load('acl.json')),
  consumer = JSON.decode(pipy.load('consumer.json')),

  {
    insert_pipy,
    update_response_time,
  } = pipy.solve('db.js'),

  serversACL = {},
  reloadACL = rules => (
    Object.keys(serversACL).forEach(key => delete serversACL[key]),
    (rules || []).forEach(
      r => (
        (r.servers || []).forEach(
          s => serversACL[s] = r
        )
      )
    )
  ),

  serversConsumer = {},
  reloadConsumer = rules => (
    Object.keys(serversConsumer).forEach(key => delete serversConsumer[key]),
    (rules || []).forEach(
      r => (
        (r.servers || []).forEach(
          s => (
            !serversConsumer[s] && (serversConsumer[s] = {}),
            r.authentication = "Basic " + new Data((r.name || '') + ':' + (r.password || '')).toString('base64'),
            serversConsumer[s][r.authentication] = r
          )
        )
      )
    )
  ),

  chechDomainSuffix = (rule, domain) => (
    (rule?.allowDomainSuffix || []).length > 0 ? (
      rule.allowDomainSuffix.find(
        d => domain.endsWith(d)
      )
    ) : (
      (rule?.denyDomainSuffix || []).length > 0 ? (
        !rule.denyDomainSuffix.find(
          d => domain.endsWith(d)
        )
      ) : true
    )
  ),

  checkDomain = (server, user, domain) => (
    chechDomainSuffix(serversACL[server?.serviceName], domain) && chechDomainSuffix(user, domain)
  ),

  pipyProxyActiveConnectionGauge = new stats.Gauge('pipy_proxy_active_connection', ['source_ip', 'destination']),
  pipyProxyTotalConnectionCounter = new stats.Counter('pipy_proxy_total_connection', ['source_ip', 'destination']),
  pipyProxySendBytesTotalCounter = new stats.Counter('pipy_proxy_send_bytes_total', ['source_ip', 'destination']),
  pipyProxyReceiveBytesTotalCounter = new stats.Counter('pipy_proxy_receive_bytes_total', ['source_ip', 'destination']),

  accessLog = config?.accessLog?.reduce?.(
    (logger, target) => (
      logger.toHTTP(
        target.url, {
        headers: target.headers,
        batch: target.batch
      }
      )
    ),
    new logging.JSONLogger('access')
  ),

  initAccessLog = (serviceName, userName, type, domain, allowed, target, path) => (
    _accessLogStruct = { trace: { id: algo.uuid() } },
    _accessLogStruct.req = { protocol: 'Proxy', path: __inbound.localAddress },
    _accessLogStruct.sid = __inbound.id,
    _accessLogStruct.serviceId = config.serviceId,
    _accessLogStruct.iid = os.env.LB_ID || config.instanceID || '',
    _accessLogStruct.proto = 'Proxy',
    _accessLogStruct.node = { ip: os.env.NODE_IP || '127.0.0.1' },
    _accessLogStruct.localAddr = __inbound.localAddress,
    _accessLogStruct.localPort = __inbound.localPort,
    _accessLogStruct.remoteAddr = __inbound.remoteAddress,
    _accessLogStruct.remotePort = __inbound.remotePort,
    _accessLogStruct.target = target,
    _accessLogStruct.proxy = {
      serviceName,
      userName,
      type,
      domain,
      allowed,
      target,
      ...path && { path }
    },
    _accessLogStruct.timestamp = Date.now()
  ),

) => (

reloadACL(acl),
reloadConsumer(consumer),

pipy({
  _pos: -1,
  _type: null,
  _path: null,
  _user: null,
  _token: null,
  _domain: null,
  _target: null,
  _message: null,
  _allowed: false,
  _accessLogStruct: null,
  _beginTime: undefined,
  _newRecord: undefined,
  _statusCode: 0,
})

.import({
  __server: 'main',
  __domain: 'ssl',
  __target: 'ssl',
})

.watch('acl.json')
.onStart(
  () => (
    acl = JSON.decode(pipy.load('acl.json')),
    reloadACL(acl),
    new StreamEnd
  )
)

.watch('consumer.json')
.onStart(
  () => (
    consumer = JSON.decode(pipy.load('consumer.json')),
    reloadConsumer(consumer),
    new StreamEnd
  )
)

.pipeline('proxy')
.branch(
  () => !__server?.serviceName, (
    $=>$.replaceStreamStart(
      () => new StreamEnd
    )
  ), (
    $=>$
    .demuxHTTP().to(
      $=>$
      .handleMessageStart(
        msg => (
          __server.enableProxyAuth && (
            (_token = msg?.head?.headers?.['proxy-authorization']) && (
              _user = serversConsumer?.[__server.serviceName]?.[_token]
            ),
            !_user && (
              _type = 'proxy-auth',
              _message = new Message({ status: 407, headers: { 'Proxy-Authenticate': 'Basic realm=' + __server.serviceName } })
            )
          ),
          !_message && (
            (msg?.head?.method === 'CONNECT') ? (
              _type = 'https'
            ) : msg?.head?.path?.startsWith('http://') ? (
              _type = 'http'
            ) : (
              _type = "unsurport"
            )
          ),
          config?.configs?.enableDebug && (
            console.log('proxy msg, type, auth:', msg, _type, _message)
          ),
          config?.configs?.accessLogSaveToSQLite && (
            _beginTime = new Date(),
            ((_type !== 'https') || !config?.configs?.sslInterception) && (
              _newRecord = insert_pipy(_type, __inbound.remoteAddress, msg?.head?.headers?.host || '', msg?.head?.path || '', msg?.head?.headers?.['user-agent'] || '')
            )
          )
        )
      )
      .branch(
        () => _type === 'http', (
          $=>$.link('http')
        ),
        () => _type === 'https', (
          $=>$.link('https')
        ),
        (
          $=>$.replaceMessage(
            () => (
              _message ? _message : new Message({ status: 403 })
            )
          )
        )
      )
    )
  )
)

.pipeline('http')
.handleMessageStart(
  msg => (
    msg.head?.headers?.['proxy-connection'] && (
      delete msg.head.headers['proxy-connection']
    ),
    (_pos = msg.head.path.indexOf('/', 7)) > 7 && (
      _target = msg.head.path.substring(7, _pos),
      msg.head.path = _path = msg.head.path.substring(_pos),
      (_pos = _target.indexOf(':')) > 0 ? (
        _domain = _target.substring(0, _pos)
      ) : (
        _domain = _target,
        _target = _target + ':80'
      ),
      !(_allowed = checkDomain(__server, _user, config?.configs?.enableAclWithPort ? _target : _domain)) && (
        _message = new Message({ status: 403 }, 'domain is not allowed!')
      ),
      accessLog && (
        initAccessLog(__server.serviceName, _user?.name, _type, _domain, Boolean(_allowed), _target, _path),
        accessLog.log(_accessLogStruct),
        config?.configs?.enableDebug && (
          console.log('https access log, response:', _accessLogStruct, '#', _message)
        )
      )
    )
  )
)
.branch(
  () => _message, (
    $=>$.replaceMessage(
      () => _message
    )
  ),
  () => _target, (
    $=>$.muxHTTP().to(
      $=>$.link('connect')
    )
  ),
  (
    $=>$.replaceMessage(
      () => new Message({ status: 400 })
    )
  )
)
.handleMessageStart(
  msg => _statusCode = (msg?.head?.status ? +msg.head.status : 0)
)
.handleMessageEnd(
  () => _newRecord?.id && (
    update_response_time(_newRecord?.id, new Date() - _beginTime, _statusCode)
  )
)

.pipeline('https')
.acceptHTTPTunnel(
  msg => (
    _target = msg.head.path,
    (_pos = _target.indexOf(':')) > 0 ? (
      _domain = _target.substring(0, _pos)
    ) : (
      _domain = _target,
      _target = _target + ':443'
    ),
    !(_allowed = checkDomain(__server, _user, config?.configs?.enableAclWithPort ? _target : _domain)) && (
      _message = new Message({ status: 403 }, 'domain is not allowed!')
    ),
    accessLog && (
      initAccessLog(__server.serviceName, _user?.name, _type, _domain, Boolean(_allowed), _target, _path),
      accessLog.log(_accessLogStruct),
      config?.configs?.enableDebug && (
        console.log('https access log, response:', _accessLogStruct, '#', _message)
      )
    ),
    _message ? _message : new Message({ status: 200 })
  )
).to(
  $=>$
  .branch(
    () => config?.configs?.sslInterception, (
      $=>$
      .onStart(
        () => void (
          __domain = _domain,
          __target = _target
        )
      )
      .use('ssl.js', 'ssl-intercept')
    ),
    (
      $=>$.link('connect')
    )
  )
)
.handleStreamEnd(
  () => _newRecord?.id && (
    update_response_time(_newRecord?.id, new Date() - _beginTime, _statusCode)
  )
)

.pipeline('connect')
.onStart(
  () => new Data
)
.handleStreamStart(
  () => _target && (
    pipyProxyActiveConnectionGauge.withLabels(__inbound?.remoteAddress, _target).increase(),
    pipyProxyTotalConnectionCounter.withLabels(__inbound?.remoteAddress, _target).increase()
  )
)
.handleData(
  data => _target && (
    pipyProxySendBytesTotalCounter.withLabels(__inbound?.remoteAddress, _target).increase(data.size)
  )
)
.connect(() => _target, { ...config?.policies })
.handleData(
  data => _target && (
    pipyProxyReceiveBytesTotalCounter.withLabels(__inbound?.remoteAddress, _target).increase(data.size)
  )
)
.handleStreamEnd(
  () => (
    _target && pipyProxyActiveConnectionGauge.withLabels(__inbound?.remoteAddress, _target).decrease()
  )
)

))()
