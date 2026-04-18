# 主题备份 1（青紫 · 科技感 v1）

恢复步骤：将本目录内文件覆盖回 `market-portal` 对应路径（并删除或停用新版中多出的文件）。**必须**同时把表中 `Nav.tsx`、`TechBackdrop.tsx`、`ProductMultiSearchForm.tsx` 拷回 `components/`，否则 `@/components/*` 会报错。

当前仓库的 `tsconfig.json` 已 `exclude` 本目录，避免备份里的旧 `layout.tsx` 参与类型检查；从备份恢复主工程后可视情况保留该 exclude。

| 备份文件 | 覆盖到 |
|---------|--------|
| `globals.css` | `app/globals.css` |
| `tailwind.config.ts` | `tailwind.config.ts` |
| `layout.tsx` | `app/layout.tsx` |
| `template.tsx` | `app/template.tsx` |
| `Nav.tsx` | `components/Nav.tsx` |
| `TechBackdrop.tsx` | `components/TechBackdrop.tsx` |
| `page.tsx` | `app/page.tsx` |
| `products-page.tsx` | `app/products/page.tsx` |
| `product-detail-page.tsx` | `app/products/[id]/page.tsx` |
| `not-found.tsx` | `app/not-found.tsx` |
| `ProductMultiSearchForm.tsx` | `components/ProductMultiSearchForm.tsx` |
