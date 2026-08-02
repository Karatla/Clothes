# Clothes 服装库存管理系统

## ⚠️ 最重要的三条

1. **`git pull` 之前，先双击 `backup.bat`**（备份数据库和商品图片）。
2. **数据库文件 `apps/api/prisma/dev.db` 不在 git 仓库里**，只存在于每台电脑本地。换电脑要手动拷贝。
3. **永远不要执行** `npx prisma migrate reset` 和 `npx prisma db push --force-reset`，这两个命令会清空所有数据。

---

## 一、全新电脑首次部署

### 1. 准备环境（只做一次）

1. 安装 **Node.js 20 LTS**（[nodejs.org](https://nodejs.org/)）。或解压绿色版 `node-v20.x-win-x64`，把解压路径加到系统环境变量 `Path` 里
   （我的电脑 → 属性 → 高级系统设置 → 环境变量 → 编辑 Path → 新建）
2. **打开一个新的命令行窗口**（改完环境变量必须重开），执行 `npm -v`，能显示版本号就说明成功
3. 换成国内镜像，下载会快很多：
   ```bat
   npm config set registry https://registry.npmmirror.com
   ```

### 2. 一键安装

把项目文件夹放好，然后双击：

```
install.bat
```

脚本会自动完成：检查 Node 版本 → 安装依赖 → **生成配置文件并随机生成密钥**（会让你输入登录邮箱和密码）→ 创建数据库 → 回填历史数据 → 编译前后端 → 放行防火墙端口。

> macOS / Linux 用 `./install.sh`

### 3. 设置固定 IP（强烈建议）

**右键 → 以管理员身份运行**：

```
set-static-ip.bat
```

不设的话，路由器随时可能给这台电脑换一个 IP，手机上的书签和以后的 HTTPS 证书都会失效。

脚本会先列出网卡、显示当前配置，让你确认后才修改。想改回自动获取：`set-static-ip.bat revert`

### 4. 启动

```
start-api.bat     后端
start-web.bat     前端
```

两个窗口都要保持打开，关掉就等于停止服务。

浏览器访问：

- 本机：`http://localhost:3000`
- 手机 / 平板：`http://<这台电脑的IP>:3000`（安装脚本最后会告诉你这个地址）

---

## 二、日常更新（收到新版本后）

**顺序很重要**：

```
1. backup.bat          先备份！
2. git pull            拉取新版本
3. release-update.bat  更新
4. start-api.bat + start-web.bat   重新启动
```

`release-update.bat` 会自动：备份 → 安装新依赖 → 数据库迁移 → 重新生成 Prisma Client → 回填历史数据 → 编译前后端。

> macOS / Linux 用 `./backup.sh` 和 `./release-update.sh`

---

## 三、脚本一览

| 脚本 | 作用 | 何时用 |
|---|---|---|
| `install.bat` / `.sh` | 全新电脑首次安装 | 只用一次 |
| `backup.bat` / `.sh` | 备份数据库 + 商品图片到 `backups/` | **每次 git pull 之前** |
| `release-update.bat` / `.sh` | 日常更新 | 每次收到新版本 |
| `start-api.bat` / `.sh` | 启动后端 | 每次开机 |
| `start-web.bat` / `.sh` | 启动前端 | 每次开机 |
| `set-static-ip.bat` / `.sh` | 设置固定 IP（需管理员 / sudo） | 部署时一次 |
| `open-firewall.bat` / `.sh` | 放行 3000/3001/3443/3444 端口（需管理员 / sudo） | 部署时一次，install 会自动调用 |
| `create-cert.bat` / `.sh` | 生成 HTTPS 证书（手机扫码用） | 部署时、IP 变化后、每年一次 |

每个脚本都有 `.bat`（Windows）和 `.sh`（macOS / Linux）两个版本，功能一致。
其中系统类脚本用的是各平台自己的工具：

| 脚本 | Windows | macOS | Linux |
|---|---|---|---|
| `set-static-ip` | `netsh` | `networksetup` | `nmcli` |
| `open-firewall` | `netsh advfirewall` | 应用防火墙（放行 node） | `ufw` 或 `firewalld` |

这两个会修改系统设置，**运行前会先显示当前配置并要求你输入 YES 确认**，也都支持 `revert` 改回去。

备份保留最近 10 份，存放在 `backups/`，不会进入 git 仓库。

---

## 四、手机摄像头扫码（HTTPS 证书）

手机浏览器规定**只有安全连接（https）才能打开摄像头**。店里是局域网、没有域名，所以要用这台电脑自己签发的证书，手机信任一次即可。

### 电脑上（一次）

```
1. set-static-ip.bat     先把 IP 固定下来（管理员运行）
2. create-cert.bat       生成证书
3. 重启 start-api.bat 和 start-web.bat
```

> macOS / Linux：`./set-static-ip.sh` → `./create-cert.sh` → 重启两个服务

生成后会多出四个地址：

| | http（日常用） | https（扫码用） |
|---|---|---|
| 前端 | `http://<ip>:3000` | `https://<ip>:3443` |
| 后端 | `http://<ip>:3001` | `https://<ip>:3444` |

**http 不能关**：手机在信任证书之前只能通过 http 下载证书。

### 手机上（每台一次）

浏览器打开 `http://<电脑IP>:3000/setup/certificate`，页面会自动识别 iPhone 还是 Android 并给出对应步骤，点按钮下载证书后按提示安装。

⚠️ **iPhone 最容易漏的一步**：装完描述文件后，还要去
**设置 → 通用 → 关于本机 → 最底部「证书信任设置」**，把 `Clothes Local CA` 的开关打开，否则不生效。

装好后点页面上的「打开安全版本」，以后手机就用 `https://<ip>:3443` 这个地址。

### 什么时候要重新生成证书

| 情况 | 要做什么 | 手机要重装吗 |
|---|---|---|
| 电脑 IP 变了 | 重新运行 `create-cert.bat` | **不用** |
| 证书到期（约一年） | 重新运行 `create-cert.bat` | **不用** |
| 换了新电脑 | 运行 `create-cert.bat` | 要重装 |

根证书有效期 10 年且每次生成都会复用，所以只要不换电脑，手机就永远不用再装第二次。

## 五、扫码与打印

### 商品贴码

每个「商品 + 颜色 + 尺码」有一个唯一的二维码编号（如 `10000001`），**同款同色同码共用一个码**。
录商品、进货入库时自动发码，历史商品由更新脚本自动补发。

打印标签的三个入口：
- 进货入库保存成功后 →「打印本次入库标签」（进货当场贴，最方便）
- 商品详情页 →「打印标签」
- 库存总览 →「打印商品标签」

标签尺寸默认 40×30mm，在系统设置里可改成 50×30 / 60×40 / A4 不干胶。

### 扫码开单

销售开单页顶部有两种扫码方式：
- **摄像头扫码**：点「扫码开单」，需要先装好证书（见第四节）
- **扫码枪**：直接扫旁边那个输入框即可，扫码枪等于键盘，不需要装证书

扫到已在单子里的商品会自动数量 +1，新商品自动带出售价。

### 小票打印

销售保存后点「打印小票」，或在销售记录里每单都有打印入口。
纸张默认 80mm 热敏纸，系统设置里可改 58mm 或 A4。
小票底部会印订单二维码，**退换货时在退换货页点「扫小票」扫一下即可直接定位订单**。

## 六、手机 / 平板访问

1. 手机和电脑必须连**同一个 Wi-Fi**
2. 浏览器打开 `http://<电脑IP>:3000`
3. 打不开时按顺序排查：
   - 电脑上 `http://localhost:3000` 能不能打开（不能 → 前端没启动）
   - 手机上 `http://<电脑IP>:3001` 有没有反应（完全连不上 → 防火墙，用管理员运行 `open-firewall.bat`）
   - 电脑 IP 是不是变了（用 `ipconfig` 查，或运行 `set-static-ip.bat` 固定下来）

前端会自动把后端地址跟随当前访问的地址，**不需要**为手机单独改配置文件。

---

## 七、数据与备份

| 内容 | 位置 | 进 git 吗 |
|---|---|---|
| 数据库 | `apps/api/prisma/dev.db` | ❌ 不进 |
| 商品图片 | `apps/api/uploads/` | ❌ 不进 |
| 配置（含密码、密钥） | `apps/api/.env`、`apps/web/.env.local` | ❌ 不进 |
| 备份 | `backups/<时间戳>/` | ❌ 不进 |

**换电脑搬数据**：在旧电脑跑一次 `backup.bat`，把 `backups/` 下最新那个文件夹拷到新电脑，新电脑跑完 `install.bat` 后，用备份里的 `dev.db` 覆盖 `apps/api/prisma/dev.db`，把 `uploads.zip` 解压到 `apps/api/uploads/`，再重启服务。

---

## 八、常见问题

**编译时报 `Module '"@prisma/client"' has no exported member ...`**
在 `apps/api` 目录执行 `npx prisma generate`。

**后端启动报缺少 ADMIN_EMAIL / ADMIN_PASSWORD**
`apps/api/.env` 没生成或被删了，重新跑 `install.bat` 会补上（已有的不会被覆盖）。

**数据库连接报错**
检查 `apps/api/.env` 里是 `DATABASE_URL="file:./dev.db"`，不能写成 `sqlite:./dev.db`。

**手机上登录显示"Load failed"**
后端 3001 端口没放行，用管理员运行 `open-firewall.bat`。

**这次更新时 `git pull` 报 `dev.db` 冲突（只会出现一次）**
这是因为本次更新把数据库文件移出了 git 仓库。**你本地的数据库是安全的**，按下面处理：

```bat
backup.bat
git rm --cached apps/api/prisma/dev.db
git pull
```

`git rm --cached` 只是让 git 不再跟踪这个文件，**不会删除本地文件**。
处理完之后确认 `apps/api/prisma/dev.db` 还在、大小正常，就可以继续 `release-update.bat`。
万一文件不见了，从 `backups/` 里最新那份 `dev.db` 拷回去即可。

---

## 九、开发者说明

```bash
npm install            # 根目录，workspace 一次装全
cd apps/api && npm run start:dev     # 后端开发模式
cd apps/web && npm run dev           # 前端开发模式
```

- Node 版本：见 `.nvmrc`，用 `nvm use`
- 数据库迁移：改完 `schema.prisma` 后 `npx prisma migrate dev --name xxx`
- 一次性数据脚本放在 `apps/api/scripts/`，必须写成**可重复执行**（幂等），因为更新脚本每次都会跑
