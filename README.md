# 1. pipy web-proxy  
用于 HTTP、HTTPS 代理访问，支持 Basic 认证。  
可以全局设置允许访问的域名，也可以针对具体的用户设置允许访问的域名。  

# 2. 配置文件说明  
## 2.1 acl.json  
全局设置允许访问的域名  
```json
[
  {
    "allowDomainSuffix": [],
    "denyDomainSuffix": [
      ".xyz001.com"
    ],
    "servers": [
      "svc-1",
      "svc-2"
    ]
  }
]
```
allowDomainSuffix ： 允许访问的域名 （白名单）  
denyDomainSuffix： 禁止访问的域名 （黑名单）  
servers： web-proxy 服务列表   

# 2.2 consumer.json
用户配置  
```json
[
  {
    "name": "test",
    "password": "123456",
    "allowDomainSuffix": [
    ],
    "servers": [
      "svc-1",
      "svc-2"
    ]
  },
  {
    "name": "test2",
    "password": "12345678",
    "denyDomainSuffix": [
      ".baidu.com",
      ".google.com"
    ],
    "servers": [
      "svc-1"
    ]
  }
]
```
name: Basic 登录的用户名  
password: Basic 登录的密码  
allowDomainSuffix ： 允许访问的域名 （白名单）  
denyDomainSuffix： 禁止访问的域名 （黑名单）  
servers： web-proxy 服务列表  

# 2.3 config.json  
```json
{
  "configs": {
    "enableDebug": true
  },
  "servers": {
    "0.0.0.0:6060": {
      "enableProxyAuth": true,
      "serviceName": "svc-1"
    }
  },
  "policies": {
    "connectTimeout": "3s",
    "idleTimeout": "30s"
  },
  "accessLog": [
    {
      "url": "http://192.168.123.1:8123/?query=insert%20into%20log(message)%20format%20JSONAsString",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Basic ZGVmYXVsdDoxMjM0NTY="
      },
      "batch": {
        "timeout": 1,
        "interval": 1,
        "size": 100,
        "prefix": "[",
        "postfix": "]",
        "separator": ","
      }
    }
  ]
}
```
enableProxyAuth: 是否开启 Basic 认证，开启后需要输入用户名、密码。  
