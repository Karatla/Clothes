# Clothes Stock System — TODO

## Phase 0: Project Hygiene
- [ ] Confirm Node 20.11.1 (per .nvmrc)
- [ ] Verify dev servers: web (3000), api (3001)

## Phase 1: Authentication (Single Admin, JWT)
- [ ] Add env-based admin account (ADMIN_EMAIL/ADMIN_PASSWORD)
- [ ] JWT auth: login + refresh endpoints
- [ ] httpOnly cookie storage (access + refresh)
- [ ] Protect all non-auth routes (JWT guard)
- [ ] Login page (中文) + logout

## Phase 2: Product + Variant Entry (Core)
- [ ] Product model: 商品名称, 基础编码, 分类, 标签, 图片
- [ ] Variant model: 颜色(中文), 尺码(S/M/L/XL/2XL), 数量, 成本价, 默认售价
- [ ] SKU规则: 基础编码-颜色-尺码 (例: 5031-灰-S)
- [ ] Product Entry UI (中文)
  - [ ] 基础信息表单
  - [ ] 颜色行 + 尺码列的表格输入
  - [ ] 每行颜色合计（数量/金额）
  - [ ] 总合计（数量/金额）
  - [ ] 图片上传
- [ ] API: 新建产品 + 变体（一次提交）

## Phase 3: Inventory
- [ ] Stock tracking per variant
- [ ] Stock movement table (in/out/adjust)

## Phase 4: Sales (Custom Price)
- [ ] Sales UI (中文)
  - [ ] 选择商品 → 颜色 → 尺码 → 数量
  - [ ] 自定义单价输入
  - [ ] 小计/合计自动计算
- [ ] Create sale → 库存扣减
- [ ] Delete sale → 库存回滚

## Phase 5: Returns / Exchanges
- [ ] Return flow (关联原销售单)
- [ ] Return → 库存增加
- [ ] Exchange = 退货 + 新销售

## Phase 6: Reports
- [ ] 单品销量统计
- [ ] 成本、收入、利润
- [ ] 日期范围筛选

## Per-Phase Testing
- [ ] After each phase, run dev servers and verify UI + API manually
- [ ] Only proceed to next phase after confirmation

## UI/UX Quality Bar
- [ ] 表格为中心、输入快捷
- [ ] 中英文混排避免（中文UI）
- [ ] 视觉干净、响应快
