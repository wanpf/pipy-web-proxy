    
一、安装，启动服务，操作步骤：    
0、需要先安装好 pipy、openssl 这2个程序，    
  并且加入到 PATH 环境变量，可以直接输入 pipy, openssl 启动程序。    
1、安装CA根证书，    
  将 CA.crt 安装到系统，或者安装到浏览器。    
2、在当前目录下，执行如下2命令，解压证书签发工具包。    
   sudo mkdir -p /opt/flomesh/    
   sudo tar zxvf mkcrt.tar.z -C /opt/flomesh/    
   sudo chmod -R ugo=rwx /opt/flomesh/    
3、执行如下命令，启动 pipy-proxy 服务。    
注意：9090、6060 这2个端口需要可用。    
   pipy pjs/main.js    
    
二、测试    
1、给浏览器设置 http、https 代理，代理地址 IP地址:9090    
2、浏览器访问 https//www.gov.cn/ 等网站    
3、浏览器访问 http://IP地址:6060/ 查看 pipy-proxy GUI 网页。    
    

