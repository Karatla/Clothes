# Clothes

1) Open terminal and go to project root  
cd /path/to/Clothes
2) Install dependencies (root workspace)  
npm install
3) Create env files  
cd apps/api
cp .env.example .env
cd ../web
cp .env.example .env.local
4) Build (production)  
cd ../api
npm run build
cd ../web
npm run build
5) Run API  
cd ../api
npm run start:prod/node dist/src/main.js
6) Run Web  
cd ../web
npm run start

## Startup Checks

### Web (Next.js)
From repo root:
- `cd apps/web`
- `npm run dev`
npm run start(for product)

Open http://localhost:3000 — you should see the default Next.js page.

### API (NestJS)
From repo root:
- `cd apps/api`
- `npm run start:dev`
npm run start:prod(for product)

Default endpoint: http://localhost:3000/
If you change the port later, update this section.

### Node Version
Use Node 20.19.0 for best compatibility:
- `nvm use`

if mention : error TS2305: Module '"@prisma/client"' has no exported member 'StockMovementType'.
2 import { PrismaClient, StockMovementType } from '@prisma/client';
npx prisma generate



1、把Clothes-main和node-v20.20.0-win-x64解压在同一目录下
2、环境变量：我的电脑——属性——高级系统设置——环境变量——编辑（path）_新建node-v20.20.0-win-x64（解压后的路径）
3、输入npm -v   测试（改变环境变量之后要打开新的终端）成功了显示版本号
4、测试成功，改变镜像 npm config set registry https://registry.npmmirror.com
5、测试镜像是否成功  npm config get registry ，如果成功，会显示4的网址
第一阶段搭建环境成功。


第二阶段编译工程文件（有更新后执行第3——6布）
0, npm install
1、把.env文件复制到apps\api   下面
2、把.env,local文件复制到web里面
3、进入到api文件夹，运行 npx prisma generate，成功后
4、运行     npm run build     进行编译库 （必须在api目录里很重要）
5、进入到 web目录 npm run build   进行编译库 （必须在web目录里很重要）
6, 如果数据库更新了执行这一步：npx prisma migrate deploy


初始化数据库文件：（删除该文件）   apps/api/prisma/dev.db

刷新数据库：在该文件目录里执行该命令：    npx prisma migrate dev
删除数据文件：Clothes-main\apps\api\data\所有文件
                         \Clothes-main\apps\api\uploads\所有图片



第3阶段（每次启动电脑都要运行）
1、执行    node dist/src/main.js   （一定是在api文件下运行）启动服务器
2、测试服务器是否成功  http://localhost:3001/health    显示OK，表示成功（打开浏览器）
3、运行网页端：  npm run start  (前端服务器启动）必须在WeB目录下
4、CTRT+鼠标左键，启动网页端
CTRT+C退出终端

## 新程序的更新步骤

当收到新程序更新后，请按下面步骤操作：

1. 进入 `apps/api` 目录
2. 执行数据库迁移：
   ```bash
   npx prisma migrate deploy
   ```
3. 重新生成 Prisma 客户端：
   ```bash
   npx prisma generate
   ```
4. 在 `apps/api` 目录执行编译：
   ```bash
   npm run build
   ```
5. 进入 `apps/web` 目录执行编译：
   ```bash
   npm run build
   ```

说明：
- `npx prisma migrate deploy`：把新版本数据库结构更新到本地已有数据库，不会像重置数据库那样清空原有数据
- `npx prisma generate`：根据最新数据库结构重新生成 Prisma 客户端
- 这两个命令都需要在 `apps/api` 目录中执行

## Release 版本运行步骤

发给客户后的 Release 版本，请按下面步骤运行：

1. 先备份数据库文件：
   ```bash
   cp apps/api/prisma/dev.db apps/api/prisma/dev.db.backup
   ```
2. 进入 `apps/api` 目录
3. 执行数据库迁移：
   ```bash
   npx prisma migrate deploy
   ```
4. 重新生成 Prisma 客户端：
   ```bash
   npx prisma generate
   ```
5. 编译后端：
   ```bash
   npm run build
   ```
6. 进入 `apps/web` 目录并编译前端：
   ```bash
   npm run build
   ```
7. 启动后端：
   ```bash
   cd ../api
   node dist/src/main.js
   ```
8. 启动前端：
   ```bash
   cd ../web
   npm run start
   ```

注意：
- 如果是第一次部署，先在项目根目录执行 `npm install`
- 不要执行 `npx prisma migrate reset`
- 不要执行 `npx prisma db push --force-reset`
- 上面两个命令可能会清空数据库数据

## 脚本使用说明

为了方便客户更新和启动程序，项目根目录提供了 6 个脚本文件，分别用于更新程序、启动后端、启动前端。

### 一、更新脚本

#### 1. `release-update.bat`
适用于 Windows 用户。

作用：
- 自动备份数据库文件 `apps/api/prisma/dev.db`
- 自动执行数据库迁移
- 自动重新生成 Prisma Client
- 自动编译后端
- 自动编译前端

使用方法：
- 直接双击运行
- 或在命令行中执行：
  ```bat
  release-update.bat
  ```

说明：
- 脚本执行完成后不会自动关闭，会停留在窗口中，方便查看结果
- 如果更新失败，也会停留在错误界面，方便排查问题

#### 2. `release-update.sh`
适用于 macOS / Linux 用户。

作用：
- 自动备份数据库文件 `apps/api/prisma/dev.db`
- 自动执行数据库迁移
- 自动重新生成 Prisma Client
- 自动编译后端
- 自动编译前端

使用方法：
```bash
./release-update.sh
```

如果第一次无法运行，可先执行：
```bash
chmod +x release-update.sh
```

### 二、启动后端脚本

#### 3. `start-api.bat`
适用于 Windows 用户。

作用：
- 进入 `apps/api`
- 启动后端正式版服务

使用方法：
- 直接双击运行
- 或在命令行中执行：
  ```bat
  start-api.bat
  ```

说明：
- 运行后窗口会一直保持打开状态，这是正常现象
- 关闭该窗口，后端服务就会停止

#### 4. `start-api.sh`
适用于 macOS / Linux 用户。

作用：
- 进入 `apps/api`
- 启动后端正式版服务

使用方法：
```bash
./start-api.sh
```

如果第一次无法运行，可先执行：
```bash
chmod +x start-api.sh
```

### 三、启动前端脚本

#### 5. `start-web.bat`
适用于 Windows 用户。

作用：
- 进入 `apps/web`
- 启动前端正式版服务

使用方法：
- 直接双击运行
- 或在命令行中执行：
  ```bat
  start-web.bat
  ```

说明：
- 运行后窗口会一直保持打开状态，这是正常现象
- 关闭该窗口，前端服务就会停止

#### 6. `start-web.sh`
适用于 macOS / Linux 用户。

作用：
- 进入 `apps/web`
- 启动前端正式版服务

使用方法：
```bash
./start-web.sh
```

如果第一次无法运行，可先执行：
```bash
chmod +x start-web.sh
```

### 四、推荐使用顺序

每次收到新版本更新后，建议按下面顺序操作：

1. 先运行更新脚本
Windows：
```bat
release-update.bat
```

macOS / Linux：
```bash
./release-update.sh
```

2. 更新完成后，启动后端
Windows：
```bat
start-api.bat
```

macOS / Linux：
```bash
./start-api.sh
```

3. 再启动前端
Windows：
```bat
start-web.bat
```

macOS / Linux：
```bash
./start-web.sh
```

### 五、注意事项

- 更新程序前，脚本会自动备份数据库
- 不要执行 `npx prisma migrate reset`
- 不要执行 `npx prisma db push --force-reset`
- 上面两个命令可能会清空数据库数据
- 后端和前端启动后，窗口保持打开是正常现象，不要关闭
