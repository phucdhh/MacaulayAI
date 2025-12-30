# Macaulay2Web - Ứng Dụng Web cho Macaulay2

Triển khai Macaulay2Web trên server Mac Mini M2 với domain `macaulay2.truyenthong.edu.vn`.

## Giới thiệu

Macaulay2Web là một ứng dụng web cung cấp giao diện trình duyệt cho [Macaulay2](http://www.macaulay2.com/), một hệ thống đại số máy tính chuyên về đại số giao hoán và hình học đại số. Dự án này dựa trên [Macaulay2Web](https://github.com/pzinn/Macaulay2Web) của pzinn.

### Tính năng chính

- **Giao diện web thân thiện**: Không cần cài đặt Macaulay2 trên máy người dùng
- **Editor tích hợp**: Viết và chạy code Macaulay2 trực tiếp trên trình duyệt
- **Hỗ trợ KaTeX/HTML**: Hiển thị công thức toán học đẹp mắt
- **Tutorials tương tác**: Học và giảng dạy đại số giao hoán và hình học đại số
- **Quản lý phiên làm việc**: Mỗi người dùng có môi trường riêng biệt
- **Docker containers**: Cách ly và bảo mật cho từng phiên người dùng

## Kiến trúc hệ thống

### Môi trường Server
- **Hardware**: Mac Mini M2 (headless)
- **OS**: macOS
- **Location**: `/Users/mac/Macaulay2/`
- **Port**: 5657 (tránh xung đột với các ứng dụng khác)
- **Domain**: `macaulay2.truyenthong.edu.vn`
- **Tunnel**: Cloudflare Tunnel (cloudflared)

### Stack công nghệ
- **Backend**: Node.js, TypeScript
- **Frontend**: TypeScript, KaTeX, HTML/CSS
- **Containerization**: Docker (m2container)
- **SSH**: Secure communication với Docker containers
- **Reverse Proxy**: Cloudflare Tunnel

### Các ứng dụng khác trên cùng server
- AIThink
- HeyTeX
- HeyMac
- HeyStat
- CoSheet

## ⚠️ Lưu ý quan trọng - ARM64 Compatibility

**KNOWN ISSUE**: Docker image `pzinn/m2container` hiện chỉ hỗ trợ kiến trúc **x86_64/amd64**. Trên Mac M2 (ARM64), Macaulay2 binary sẽ không chạy được thông qua emulation và gây lỗi "Illegal instruction".

**Trạng thái hiện tại**:
- ✅ Web interface đang hoạt động tại https://macaulay2.truyenthong.edu.vn
- ✅ Frontend, editor, tutorials có thể truy cập
- ❌ Macaulay2 computations sẽ fail (do ARM compatibility)

**Giải pháp**:
1. ✅ **Đang thực hiện**: Cài Macaulay2 native trên Mac M2 qua Homebrew
2. **Thay thế**: Deploy trên server x86_64/amd64 (Intel/AMD CPU)
3. **Tạm thời**: Sử dụng như interface demo, users chỉ xem UI

### Cài đặt Macaulay2 native cho ARM64 (Mac M2)

Macaulay2 có hỗ trợ ARM64 qua Homebrew:

```bash
# Add Macaulay2 tap
brew tap Macaulay2/tap

# Install Macaulay2 (có pre-built bottle cho ARM64)
brew install M2

# Verify installation
M2 --version

# Test
M2 --webapp
```

Sau khi cài xong, cấu hình Macaulay2Web để dùng M2 native thay vì Docker.

## Yêu cầu hệ thống

### Phần mềm cần thiết
- [x] **Node.js** (v14+)
- [x] **npm** (v6+)
- [x] **Git**
- [x] **Docker Desktop** for Mac (hoặc Docker Engine)
- [x] **SSH server** (built-in macOS)
- [x] **Cloudflare Tunnel** (cloudflared)
- ⚠️ **x86_64 Architecture** (Intel/AMD) - ARM64 chưa được hỗ trợ đầy đủ

### Kiểm tra điều kiện tiên quyết

```bash
# Kiểm tra Node.js
node --version  # Should be v14 or higher

# Kiểm tra npm
npm --version

# Kiểm tra Docker
docker --version

# Kiểm tra Git
git --version

# Kiểm tra cloudflared
cloudflared --version

# Kiểm tra SSH
ssh -V
```

## Cài đặt

### Bước 1: Clone repository

```bash
cd /Users/mac/Macaulay2
git clone https://github.com/pzinn/Macaulay2Web.git .
git submodule init
git submodule update
```

### Bước 2: Cài đặt dependencies

```bash
npm install
```

### Bước 3: Build ứng dụng

```bash
npm run build
```

### Bước 4: Thiết lập SSH keys

```bash
# Tạo SSH key cho Docker containers
ssh-keygen -b 1024 -f id_rsa -P ''
```

### Bước 5: Pull và build Docker image

```bash
# Pull base image từ Docker Hub
docker pull pzinn/m2container

# Build local image
docker build -t m2container .
```

### Bước 6: Cấu hình port

Chỉnh sửa file `src/server/defaultOptions.ts` để thay đổi port mặc định:

```typescript
export const defaultOptions = {
  // ...
  port: 5657,  // Thay vì 8002 mặc định
  // ...
};
```

### Bước 7: Cấu hình Cloudflare Tunnel

#### 7.1. Thêm tunnel mới (nếu chưa có)

```bash
# Login vào Cloudflare (nếu chưa)
cloudflared tunnel login

# Tạo tunnel mới
cloudflared tunnel create macaulay2-tunnel

# Ghi chú tunnel UUID được tạo
```

#### 7.2. Cấu hình tunnel

Tạo hoặc chỉnh sửa file cấu hình tunnel (thường tại `~/.cloudflared/config.yml`):

```yaml
tunnel: <tunnel-uuid>
credentials-file: /Users/mac/.cloudflared/<tunnel-uuid>.json

ingress:
  # Macaulay2Web
  - hostname: macaulay2.truyenthong.edu.vn
    service: http://localhost:5657
  
  # Các ứng dụng khác đã có...
  # - hostname: aithink.truyenthong.edu.vn
  #   service: http://localhost:XXXX
  # ...
  
  # Catch-all rule (bắt buộc)
  - service: http_status:404
```

#### 7.3. Cấu hình DNS trên Cloudflare

Trên dashboard Cloudflare cho domain `truyenthong.edu.vn`:

1. Vào **DNS** > **Records**
2. Thêm CNAME record:
   - **Type**: CNAME
   - **Name**: macaulay2
   - **Target**: `<tunnel-uuid>.cfargotunnel.com`
   - **Proxy status**: Proxied (orange cloud)

Hoặc sử dụng CLI:

```bash
cloudflared tunnel route dns macaulay2-tunnel macaulay2.truyenthong.edu.vn
```

#### 7.4. Khởi động tunnel

```bash
# Chạy trong chế độ background
cloudflared tunnel run macaulay2-tunnel &

# Hoặc dùng service (recommended)
# Tạo service file nếu chưa có
sudo cloudflared service install

# Restart service
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared
```

## Chạy ứng dụng

### Development mode (local testing)

```bash
# Chạy với Docker containers
npm start docker

# Hoặc redirect output vào log file
npm start docker > macaulay2web.log 2>&1 &
```

### Production mode

**Lưu ý**: Trên Mac Mini M2, chúng ta sử dụng **local mode** với Macaulay2 native (ARM64) thay vì Docker.

```bash
# Cài đặt PM2 globally (nếu chưa có)
npm install -g pm2

# Start với PM2 (local mode với M2 native)
cd /Users/mac/Macaulay2
pm2 start npm --name "macaulay2web-local" -- start local

# Cấu hình PM2 tự khởi động khi reboot (cho headless Mac Mini)
pm2 save
pm2 startup launchd
# Chạy command được suggest bởi PM2 (ví dụ):
sudo env PATH=$PATH:/opt/homebrew/Cellar/node/25.2.1/bin /opt/homebrew/lib/node_modules/pm2/bin/pm2 startup launchd -u mac --hp /Users/mac

# Verify LaunchAgent đã được tạo
ls -la ~/Library/LaunchAgents/pm2.mac.plist

# Test reboot (optional)
# sudo reboot
# Sau khi reboot, check:
# pm2 list
```

**Chú ý cho Docker mode** (nếu dùng trên x86_64 server):
```bash
pm2 start npm --name "macaulay2web" -- start docker
```

### Kiểm tra ứng dụng

```bash
# Test local
curl http://localhost:5657

# Test qua Cloudflare tunnel
curl https://macaulay2.truyenthong.edu.vn
```

## Cấu hình nâng cao

### Auto-startup cho headless Mac Mini

Trên Mac Mini M2 headless, PM2 cần được cấu hình với LaunchAgent để tự động khởi động sau reboot:

```bash
# PM2 đã tạo LaunchAgent tại
~/Library/LaunchAgents/pm2.mac.plist

# Verify service đang chạy
launchctl list | grep pm2

# Nếu cần reload
launchctl unload ~/Library/LaunchAgents/pm2.mac.plist
launchctl load -w ~/Library/LaunchAgents/pm2.mac.plist

# Check PM2 processes sau reboot
pm2 list
pm2 logs macaulay2web-local

# PM2 log files
/tmp/com.PM2.out  # stdout
/tmp/com.PM2.err  # stderr
```

**Services khác cần chạy**:
- ✅ Cloudflare Tunnel (com.cloudflare.cloudflared)
- ✅ PM2 (com.PM2) → macaulay2web-local
- ✅ SSH server (built-in macOS)

### Resource limits

Chỉnh sửa `src/server/defaultOptions.ts`:

```typescript
export const defaultOptions = {
  // ...
  maxMemory: "2g",        // Memory limit per container
  cpus: 1,                // CPU limit per container
  maxUsers: 100,          // Maximum concurrent users
  containerTimeout: 3600, // Container timeout in seconds (1 hour)
  // ...
};
```

### Admin access

Thiết lập admin ID trong `src/server/defaultOptions.ts`:

```typescript
export const defaultOptions = {
  // ...
  adminName: "admin-secure-id-12345",
  // ...
};
```

Truy cập admin bằng cách thêm `?user=admin-secure-id-12345` vào URL.

### HTTPS (nếu cần)

Cloudflare Tunnel đã cung cấp SSL/TLS tự động, nhưng nếu cần HTTPS trực tiếp:

```bash
git checkout https
# Follow additional setup instructions trong branch https
```

## Quản lý và Monitoring

### Xem logs

```bash
# PM2 logs
pm2 logs macaulay2web

# Hoặc tail log file
tail -f macaulay2web.log

# Cloudflared logs
sudo tail -f /var/log/cloudflared.log
```

### Kiểm tra containers

```bash
# Liệt kê running containers
docker ps

# Xem resource usage
docker stats

# Dọn dẹp stopped containers
docker container prune
```

### Restart services

```bash
# Restart ứng dụng
pm2 restart macaulay2web

# Rebuild và restart
npm run build && pm2 restart macaulay2web

# Restart Cloudflare tunnel
sudo launchctl restart com.cloudflare.cloudflared
```

## Troubleshooting

### Port đã được sử dụng

```bash
# Kiểm tra port 5657
lsof -i :5657

# Kill process nếu cần
kill -9 <PID>
```

### Docker container không start

```bash
# Kiểm tra Docker daemon
docker info

# Restart Docker Desktop
# Hoặc: sudo systemctl restart docker (Linux)

# Xem logs của container
docker logs <container-id>
```

### SSH connection issues

```bash
# Test SSH
ssh -i id_rsa localhost

# Kiểm tra SSH service
sudo launchctl list | grep ssh

# Generate lại keys nếu cần
rm -f id_rsa id_rsa.pub
ssh-keygen -b 1024 -f id_rsa -P ''
```

### Cloudflare tunnel không hoạt động

```bash
# Kiểm tra tunnel status
cloudflared tunnel info macaulay2-tunnel

# Test connectivity
cloudflared tunnel run --config ~/.cloudflared/config.yml

# Kiểm tra DNS
nslookup macaulay2.truyenthong.edu.vn
```

## Bảo mật

### Best practices
- ✅ Docker containers cách ly từng user
- ✅ SSL/TLS qua Cloudflare
- ✅ Resource limits cho mỗi container
- ✅ SSH key authentication
- ✅ Không expose direct ports ra public
- ⚠️ Thiết lập admin ID mạnh
- ⚠️ Regular updates và patches
- ⚠️ Monitor logs cho suspicious activities

### Backup

```bash
# Backup cấu hình
tar -czf backup-$(date +%Y%m%d).tar.gz \
  src/server/defaultOptions.ts \
  id_rsa \
  ~/.cloudflared/config.yml \
  package.json

# Restore
tar -xzf backup-YYYYMMDD.tar.gz
```

## Cập nhật

### Update Macaulay2Web

```bash
# Pull latest changes
git pull origin main
git submodule update

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Restart (sử dụng local mode)
pm2 restart macaulay2web-local
```

### Update Macaulay2 (native)

```bash
# Update qua Homebrew
brew update
brew upgrade macaulay2

# Verify version
M2 --version

# Test
M2 --webapp <<< "2+2"

# Restart web server
pm2 restart macaulay2web-local
```

### Update Docker image (nếu dùng Docker mode)

```bash
# Pull latest base image
docker pull pzinn/m2container

# Rebuild
docker build -t m2container .

# Restart để sử dụng image mới
pm2 restart macaulay2web
```

## Quick Reference - Quản lý hệ thống

### Sau khi reboot Mac Mini

```bash
# 1. Kiểm tra services tự động start
sudo launchctl list | grep cloudflare  # Cloudflare Tunnel
pm2 list                               # PM2 processes

# 2. Nếu PM2 chưa start
pm2 resurrect

# 3. Check logs
pm2 logs macaulay2web-local
tail -f /tmp/com.PM2.out

# 4. Test services
curl http://localhost:5657
curl https://macaulay2.truyenthong.edu.vn

# 5. Nếu có vấn đề với Cloudflare Tunnel
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared
```

### Commands thường dùng

```bash
# PM2
pm2 list                          # Liệt kê processes
pm2 logs macaulay2web-local      # Xem logs
pm2 restart macaulay2web-local   # Restart
pm2 stop macaulay2web-local      # Stop
pm2 start macaulay2web-local     # Start
pm2 monit                         # Monitor real-time

# Macaulay2
M2 --version                      # Check version
M2 --webapp                       # Interactive webapp mode
which M2                          # Location

# System
launchctl list | grep -E "(pm2|cloudflare)"  # Check daemons
netstat -an | grep 5657                       # Check port
lsof -i :5657                                 # Process on port

# Docker (nếu cần)
docker ps                         # Running containers
docker images                     # Available images
docker system prune -a            # Cleanup
```

## Tài liệu tham khảo

- **Macaulay2Web GitHub**: https://github.com/pzinn/Macaulay2Web
- **Macaulay2 Official**: http://www.macaulay2.com/
- **Cloudflare Tunnel Docs**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **Docker Documentation**: https://docs.docker.com/

## Hỗ trợ

### Issues và bugs
- Macaulay2Web issues: https://github.com/pzinn/Macaulay2Web/issues
- Tạo issue mới cho deployment này

### Contact
- Domain admin: truyenthong.edu.vn
- Server admin: /Users/mac/Macaulay2/

## License

Macaulay2Web is licensed under MIT License. See [LICENSE](https://github.com/pzinn/Macaulay2Web/blob/main/LICENSE) for details.

---

**Last updated**: December 29, 2025  
**Version**: 2.0.0 (Native ARM64)  
**Maintainer**: truyenthong.edu.vn  
**Mode**: Local (Macaulay2 native v1.25.11 via Homebrew)  
**Server**: Mac Mini M2 (ARM64) headless
