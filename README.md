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


第二阶段编译工程文件（有更新后执行第3——5布）
1、把.env文件复制到apps\api   下面
2、把.env,local文件复制到web里面
3、进入到api文件夹，运行 npx prisma generate，成功后
4、运行     npm run build     进行编译库 （必须在api目录里很重要）
5、进入到 web目录 npm run build   进行编译库 （必须在web目录里很重要）


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
